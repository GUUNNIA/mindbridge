"use server";

import type { EscalationStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/with-auth";

/**
 * Escalation server actions (D20, PRD §6.1.3).
 *
 * 상태 전이:
 *   PENDING ──(reviewEscalation)──→ IN_REVIEW   // reviewer claim, 본 액션에서 노트 동시 저장 가능
 *   IN_REVIEW ──(signOffEscalation)──→ DECIDED  // 사인오프, RiskFlag.status = RESOLVED
 *   PENDING / IN_REVIEW ──(cron 24h+)──→ EXPIRED  // SLA cron, 운영자 알림
 *
 * 권한:
 *   - PSYCHIATRIST: read·update Escalation (ability matrix). 본인 큐 격리는
 *     server action 내부에서 reviewerId 검증.
 *   - ADMIN: manage all 로 큐 모니터링·재배정 (V2) 가능.
 *   - 다른 롤 (EMPLOYEE/COUNSELOR/HR) ability 거부 → ForbiddenError + AuditLog.
 *
 * Claim 동시성: PENDING → IN_REVIEW 시 reviewerId IS NULL + status='PENDING'
 *   조건부 updateMany 로 race 방지. count=1 일 때만 성공.
 */

export interface EscalationQueueRow {
  id: string;
  status: EscalationStatus;
  slaDueAt: Date;
  createdAt: Date;
  reviewerId: string | null;
  reviewerName: string | null;
  subject: {
    anonymizedId: string;
    nickname: string | null;
  };
  riskFlag: {
    id: string;
    summary: string | null;
    signals: { keywords?: string[]; snippet?: string } | null;
    sourceType: string;
  };
}

/**
 * 큐 목록.
 * mode="mine": 본인 IN_REVIEW + 모든 PENDING (claim 가능 풀)
 * mode="all" (ADMIN 모니터링용): 전체 PENDING/IN_REVIEW/EXPIRED 최근
 */
export const listEscalations = withAuth(
  { action: "read", subject: "Escalation" },
  async (
    ctx,
    input: { includeResolved?: boolean } = {},
  ): Promise<EscalationQueueRow[]> => {
    const isAdmin = ctx.user.role === "ADMIN";
    // 본인 EXPIRED 노출 컷오프 — SLA 24h 와 일관 (BR-6)
    const expiredWindow = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const where: Prisma.EscalationWhereInput = isAdmin
      ? input.includeResolved
        ? {}
        : { status: { in: ["PENDING", "IN_REVIEW", "EXPIRED"] } }
      : {
          // PSYCHIATRIST: 본인 IN_REVIEW + 미배정 PENDING + 본인 EXPIRED(24h 이내) 모두 노출.
          // 본인이 검토 중이던 케이스가 SLA 만료돼도 큐에서 갑자기 사라지지 않게 — 운영자 후속 조치
          // 안내 표시. 24h 지나면 큐에서 빠지고 운영자만 모니터링.
          OR: [
            { status: "PENDING" },
            { status: "IN_REVIEW", reviewerId: ctx.user.id },
            {
              status: "EXPIRED",
              reviewerId: ctx.user.id,
              expiredAt: { gte: expiredWindow },
            },
          ],
        };

    const rows = await prisma.escalation.findMany({
      where,
      orderBy: [{ status: "asc" }, { slaDueAt: "asc" }],
      take: 100,
      select: {
        id: true,
        status: true,
        slaDueAt: true,
        createdAt: true,
        reviewerId: true,
        reviewer: { select: { email: true, nickname: true } },
        subject: { select: { anonymizedId: true, nickname: true } },
        riskFlag: {
          select: {
            id: true,
            summary: true,
            signals: true,
            sourceType: true,
          },
        },
      },
    });

    return rows.map((r) => ({
      id: r.id,
      status: r.status,
      slaDueAt: r.slaDueAt,
      createdAt: r.createdAt,
      reviewerId: r.reviewerId,
      reviewerName: r.reviewer?.nickname ?? r.reviewer?.email ?? null,
      subject: r.subject,
      riskFlag: {
        id: r.riskFlag.id,
        summary: r.riskFlag.summary,
        signals: r.riskFlag.signals as { keywords?: string[]; snippet?: string } | null,
        sourceType: r.riskFlag.sourceType,
      },
    }));
  },
);

export interface EscalationDetail extends EscalationQueueRow {
  decision: string | null;
  decisionNote: string | null;
  familyConsent: boolean;
  decidedAt: Date | null;
  expiredAt: Date | null;
  reviewStartedAt: Date | null;
}

export const getEscalation = withAuth(
  { action: "read", subject: "Escalation" },
  async (
    ctx,
    input: { id: string },
  ): Promise<{ ok: true; escalation: EscalationDetail } | { ok: false; error: string }> => {
    const row = await prisma.escalation.findUnique({
      where: { id: input.id },
      select: {
        id: true,
        status: true,
        slaDueAt: true,
        createdAt: true,
        reviewerId: true,
        reviewStartedAt: true,
        decision: true,
        decisionNote: true,
        familyConsent: true,
        decidedAt: true,
        expiredAt: true,
        reviewer: { select: { email: true, nickname: true } },
        subject: { select: { anonymizedId: true, nickname: true } },
        riskFlag: {
          select: {
            id: true,
            summary: true,
            signals: true,
            sourceType: true,
          },
        },
      },
    });
    if (!row) return { ok: false, error: "에스컬레이션을 찾을 수 없습니다." };

    // PSYCHIATRIST: 본인 IN_REVIEW 또는 미배정 PENDING/EXPIRED 만 상세 view.
    // 다른 전문의가 claim 한 IN_REVIEW 는 큐에서 보이지 않으므로 직접 ID 진입 시 403.
    if (ctx.user.role === "PSYCHIATRIST") {
      const isMine = row.reviewerId === ctx.user.id;
      const isUnclaimed = row.reviewerId === null;
      if (!isMine && !isUnclaimed) {
        await prisma.auditLog.create({
          data: {
            actorId: ctx.user.id,
            action: "PERMISSION_DENIED",
            resourceType: "Escalation",
            resourceId: row.id,
            metadata: {
              reason: "claimed by other psychiatrist",
              at: "getEscalation",
            },
          },
        });
        return { ok: false, error: "다른 전문의가 검토 중인 케이스입니다." };
      }
    }

    return {
      ok: true,
      escalation: {
        id: row.id,
        status: row.status,
        slaDueAt: row.slaDueAt,
        createdAt: row.createdAt,
        reviewerId: row.reviewerId,
        reviewerName: row.reviewer?.nickname ?? row.reviewer?.email ?? null,
        reviewStartedAt: row.reviewStartedAt,
        decision: row.decision,
        decisionNote: row.decisionNote,
        familyConsent: row.familyConsent,
        decidedAt: row.decidedAt,
        expiredAt: row.expiredAt,
        subject: row.subject,
        riskFlag: {
          id: row.riskFlag.id,
          summary: row.riskFlag.summary,
          signals: row.riskFlag.signals as { keywords?: string[]; snippet?: string } | null,
          sourceType: row.riskFlag.sourceType,
        },
      },
    };
  },
);

/**
 * PENDING → IN_REVIEW 전이 (reviewer claim).
 * race 방지를 위해 updateMany 조건부 — 다른 전문의가 먼저 claim 했으면 count=0.
 */
export const reviewEscalation = withAuth(
  { action: "update", subject: "Escalation" },
  async (
    ctx,
    input: { id: string },
  ): Promise<{ ok: true } | { ok: false; error: string }> => {
    const updated = await prisma.escalation.updateMany({
      where: { id: input.id, status: "PENDING", reviewerId: null },
      data: {
        status: "IN_REVIEW",
        reviewerId: ctx.user.id,
        reviewStartedAt: new Date(),
      },
    });
    if (updated.count === 0) {
      // 이미 다른 reviewer 가 claim 또는 EXPIRED/DECIDED 전이됨
      const current = await prisma.escalation.findUnique({
        where: { id: input.id },
        select: { status: true, reviewerId: true },
      });
      if (!current) return { ok: false, error: "에스컬레이션을 찾을 수 없습니다." };
      if (current.status !== "PENDING") {
        return { ok: false, error: `이미 ${current.status} 상태입니다.` };
      }
      return { ok: false, error: "다른 전문의가 먼저 검토를 시작했습니다." };
    }
    return { ok: true };
  },
);

/**
 * IN_REVIEW → DECIDED 전이 (사인오프).
 * US-P1 AC2: 의견 입력 필수, 가족 동의 체크박스.
 * RiskFlag.status 도 RESOLVED 로 동일 트랜잭션 갱신.
 */
export const signOffEscalation = withAuth(
  { action: "update", subject: "Escalation" },
  async (
    ctx,
    input: {
      id: string;
      decision: string;
      decisionNote: string;
      familyConsent: boolean;
    },
  ): Promise<{ ok: true } | { ok: false; error: string }> => {
    const decision = input.decision.trim();
    const note = input.decisionNote.trim();
    if (decision.length === 0) return { ok: false, error: "결정 항목을 선택해 주세요." };
    if (note.length < 5) return { ok: false, error: "의견을 5자 이상 입력해 주세요." };

    const current = await prisma.escalation.findUnique({
      where: { id: input.id },
      select: { status: true, reviewerId: true, riskFlagId: true },
    });
    if (!current) return { ok: false, error: "에스컬레이션을 찾을 수 없습니다." };
    if (current.status !== "IN_REVIEW") {
      return { ok: false, error: `IN_REVIEW 상태에서만 사인오프 가능합니다. (현재 ${current.status})` };
    }
    if (current.reviewerId !== ctx.user.id) {
      await prisma.auditLog.create({
        data: {
          actorId: ctx.user.id,
          action: "PERMISSION_DENIED",
          resourceType: "Escalation",
          resourceId: input.id,
          metadata: { reason: "not assigned reviewer", at: "signOffEscalation" },
        },
      });
      return { ok: false, error: "본인이 검토 중인 케이스가 아닙니다." };
    }

    await prisma.$transaction([
      prisma.escalation.update({
        where: { id: input.id },
        data: {
          status: "DECIDED",
          decision,
          decisionNote: note,
          familyConsent: input.familyConsent,
          decidedAt: new Date(),
        },
      }),
      prisma.riskFlag.update({
        where: { id: current.riskFlagId },
        data: {
          status: "RESOLVED",
          acknowledgedAt: new Date(),
          acknowledgedById: ctx.user.id,
        },
      }),
    ]);
    return { ok: true };
  },
);
