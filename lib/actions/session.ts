"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/with-auth";
import { messagingProvider } from "@/lib/messaging/provider";
import { encryptField, decryptField } from "@/lib/crypto/field";
import { assessAndFlag } from "@/lib/actions/risk";
import type { RiskLevelOut } from "@/lib/ai/risk";

/**
 * 세션룸 Server Actions (Day 15, PRD §6.1.1).
 *
 * - enterSession: Booking → Session 1:1 생성 또는 기존 조회. 본인 참가자 검증.
 *   첫 입장 시 status SCHEDULED → IN_PROGRESS 전이 + SYSTEM "입장" 메시지 1건.
 * - sendSessionMessage: 본인 참가 + Session 활성(IN_PROGRESS) 검증. INSERT 후
 *   messagingProvider.publishMessage (mock=noop, client 는 폴링으로 fetch).
 * - listSessionMessages(sinceISO?): 폴링용 — since 이후 메시지만. 본인 참가 검증.
 *
 * 입장 조건 (D15 단순화):
 *   - Booking 본인 소유 (employee or counselor)
 *   - Booking.status != CANCELED_BY_USER / CANCELED_BY_COUNSELOR / NO_SHOW
 *   - Session.status != CANCELED / COMPLETED
 *   시간 윈도(scheduledAt ±15분)는 D16 수락 UI 도입 시 보강.
 *
 * Day 18 컬럼 암호화: content 평문 저장 → enc 컬럼으로 마이그레이션. encKeyVersion 보존.
 */

export type EnterSessionResult =
  | { ok: true; sessionId: string }
  | { ok: false; error: string };

export const enterSession = withAuth(
  { action: "update", subject: "Session" },
  async (ctx, input: { bookingId: string }): Promise<EnterSessionResult> => {
    const booking = await prisma.booking.findUnique({
      where: { id: input.bookingId },
      select: {
        id: true,
        employeeId: true,
        counselorId: true,
        status: true,
        scheduledAt: true,
      },
    });
    if (!booking) return { ok: false, error: "예약을 찾을 수 없습니다." };

    const isParticipant =
      booking.employeeId === ctx.user.id || booking.counselorId === ctx.user.id;
    if (!isParticipant) {
      await prisma.auditLog.create({
        data: {
          actorId: ctx.user.id,
          action: "PERMISSION_DENIED",
          resourceType: "Session",
          resourceId: booking.id,
          metadata: { reason: "not participant", at: "enterSession" },
        },
      });
      return { ok: false, error: "이 세션에 참가 권한이 없습니다." };
    }
    if (
      booking.status === "CANCELED_BY_USER" ||
      booking.status === "CANCELED_BY_COUNSELOR" ||
      booking.status === "NO_SHOW"
    ) {
      return { ok: false, error: "취소된 예약입니다." };
    }

    // 기존 Session 조회 or 신규 생성
    const existing = await prisma.session.findUnique({
      where: { bookingId: booking.id },
      select: { id: true, status: true },
    });

    let sessionId: string;
    let wasJustCreated = false;
    if (existing) {
      if (existing.status === "CANCELED" || existing.status === "COMPLETED") {
        return { ok: false, error: "이미 종료된 세션입니다." };
      }
      sessionId = existing.id;
    } else {
      const created = await prisma.session.create({
        data: {
          bookingId: booking.id,
          employeeId: booking.employeeId,
          counselorId: booking.counselorId,
          status: "SCHEDULED",
        },
        select: { id: true },
      });
      sessionId = created.id;
      wasJustCreated = true;
    }

    // 첫 입장 시 IN_PROGRESS 전이 + SYSTEM 메시지 1건 (D18 enc)
    if (wasJustCreated) {
      const sysEnc = encryptField("세션이 시작됐습니다. 편하게 대화를 시작해 주세요.");
      await prisma.$transaction([
        prisma.session.update({
          where: { id: sessionId },
          data: { status: "IN_PROGRESS", startedAt: new Date() },
        }),
        prisma.sessionMessage.create({
          data: {
            sessionId,
            senderId: null,
            role: "SYSTEM",
            content: sysEnc.ciphertext ?? "",
            encKeyVersion: sysEnc.encKeyVersion,
          },
        }),
      ]);
    }

    return { ok: true, sessionId };
  },
);

/** Booking 페이지의 form action 으로 — enter + redirect. */
export async function enterSessionFromBooking(bookingId: string): Promise<void> {
  const result = await enterSession({ bookingId });
  if (!result.ok) {
    throw new Error(result.error);
  }
  redirect(`/session/${result.sessionId}`);
}

const sendMessageSchema = z.object({
  sessionId: z.string().min(1),
  content: z.string().trim().min(1, "메시지를 입력해 주세요.").max(2000),
});

export type SendMessageResult =
  | { ok: true; messageId: string; riskLevel?: RiskLevelOut }
  | { ok: false; error: string };

export const sendSessionMessage = withAuth(
  { action: "update", subject: "Session" },
  async (
    ctx,
    input: z.infer<typeof sendMessageSchema>,
  ): Promise<SendMessageResult> => {
    const parsed = sendMessageSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0].message };
    }

    const session = await prisma.session.findUnique({
      where: { id: parsed.data.sessionId },
      select: {
        id: true,
        employeeId: true,
        counselorId: true,
        status: true,
      },
    });
    if (!session) return { ok: false, error: "세션을 찾을 수 없습니다." };

    let role: "EMPLOYEE" | "COUNSELOR";
    if (session.employeeId === ctx.user.id) role = "EMPLOYEE";
    else if (session.counselorId === ctx.user.id) role = "COUNSELOR";
    else {
      await prisma.auditLog.create({
        data: {
          actorId: ctx.user.id,
          action: "PERMISSION_DENIED",
          resourceType: "Session",
          resourceId: session.id,
          metadata: { reason: "not participant", at: "sendSessionMessage" },
        },
      });
      return { ok: false, error: "이 세션의 참가자가 아닙니다." };
    }

    if (session.status !== "IN_PROGRESS") {
      return { ok: false, error: "활성 세션이 아닙니다." };
    }

    const enc = encryptField(parsed.data.content);
    const message = await prisma.sessionMessage.create({
      data: {
        sessionId: session.id,
        senderId: ctx.user.id,
        role,
        content: enc.ciphertext ?? "",
        encKeyVersion: enc.encKeyVersion,
      },
      select: { id: true },
    });

    // mock provider 는 noop — client 폴링으로 fetch
    await messagingProvider.publishMessage({
      channel: `session-${session.id}`,
      event: "new-message",
      payload: { messageId: message.id, role },
    });

    // D19 — assess_risk 호출. subjectUserId 는 항상 EMPLOYEE 측 (상담사 발화도
    // 직원 케이스 위험 평가). companyId 는 직원 회사 기준.
    const employee = await prisma.user.findUnique({
      where: { id: session.employeeId },
      select: { companyId: true },
    });
    const riskOutcome = await assessAndFlag(prisma, {
      text: parsed.data.content,
      sourceType: "SESSION_MESSAGE",
      sourceId: message.id,
      subjectUserId: session.employeeId,
      companyId: employee?.companyId ?? null,
    });

    return { ok: true, messageId: message.id, riskLevel: riskOutcome.level };
  },
);

export interface SessionMessageView {
  id: string;
  role: "EMPLOYEE" | "COUNSELOR" | "SYSTEM";
  content: string;
  senderId: string | null;
  createdAtISO: string;
}

export const listSessionMessages = withAuth(
  { action: "read", subject: "Session" },
  async (
    ctx,
    input: { sessionId: string; sinceISO?: string },
  ): Promise<{ ok: true; messages: SessionMessageView[] } | { ok: false; error: string }> => {
    const session = await prisma.session.findUnique({
      where: { id: input.sessionId },
      select: { id: true, employeeId: true, counselorId: true },
    });
    if (!session) return { ok: false, error: "세션을 찾을 수 없습니다." };

    if (
      session.employeeId !== ctx.user.id &&
      session.counselorId !== ctx.user.id
    ) {
      return { ok: false, error: "이 세션의 참가자가 아닙니다." };
    }

    const since = input.sinceISO ? new Date(input.sinceISO) : undefined;
    const rows = await prisma.sessionMessage.findMany({
      where: {
        sessionId: session.id,
        ...(since ? { createdAt: { gt: since } } : {}),
      },
      orderBy: { createdAt: "asc" },
      take: 200,
      select: {
        id: true,
        role: true,
        content: true,
        encKeyVersion: true,
        senderId: true,
        createdAt: true,
      },
    });

    return {
      ok: true,
      messages: rows.map((r) => ({
        id: r.id,
        role: r.role,
        content: decryptField(r.content, r.encKeyVersion) ?? "",
        senderId: r.senderId,
        createdAtISO: r.createdAt.toISOString(),
      })),
    };
  },
);

/**
 * D21: endSession — 세션 IN_PROGRESS → COMPLETED 수동 전이.
 *
 * V1 단순화: 직원·상담사 중 한 명이 누르면 즉시 종료 (양측 합의 대기 없음).
 * SCHEDULED 상태에서도 종료 가능 (입장 전 취소와는 다름 — booking 상태는 그대로).
 * 이미 COMPLETED/CANCELED 면 noop 반환. SYSTEM "종료" 메시지 1건 추가.
 */
export const endSession = withAuth(
  { action: "update", subject: "Session" },
  async (
    ctx,
    input: { sessionId: string },
  ): Promise<{ ok: true; alreadyEnded: boolean } | { ok: false; error: string }> => {
    const session = await prisma.session.findUnique({
      where: { id: input.sessionId },
      select: {
        id: true,
        status: true,
        employeeId: true,
        counselorId: true,
      },
    });
    if (!session) return { ok: false, error: "세션을 찾을 수 없습니다." };

    if (
      session.employeeId !== ctx.user.id &&
      session.counselorId !== ctx.user.id
    ) {
      await prisma.auditLog.create({
        data: {
          actorId: ctx.user.id,
          action: "PERMISSION_DENIED",
          resourceType: "Session",
          resourceId: session.id,
          metadata: { reason: "not participant", at: "endSession" },
        },
      });
      return { ok: false, error: "이 세션의 참가자가 아닙니다." };
    }

    if (session.status === "COMPLETED" || session.status === "CANCELED") {
      return { ok: true, alreadyEnded: true };
    }

    const now = new Date();
    const actorLabel = session.employeeId === ctx.user.id ? "직원" : "상담사";
    const sysEnc = encryptField(`${actorLabel}이 세션을 종료했습니다.`);
    await prisma.$transaction([
      prisma.session.update({
        where: { id: session.id },
        data: { status: "COMPLETED", endedAt: now },
      }),
      prisma.sessionMessage.create({
        data: {
          sessionId: session.id,
          senderId: null,
          role: "SYSTEM",
          content: sysEnc.ciphertext ?? "",
          encKeyVersion: sysEnc.encKeyVersion,
        },
      }),
    ]);
    await messagingProvider.publishMessage({
      channel: `session-${session.id}`,
      event: "session-ended",
      payload: { endedAt: now.toISOString() },
    });
    return { ok: true, alreadyEnded: false };
  },
);
