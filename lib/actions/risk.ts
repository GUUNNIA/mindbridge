"use server";

import type { Prisma, RiskLevel, RiskSourceType } from "@prisma/client";

import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/with-auth";
import { assessRisk, toPrismaRiskLevel, type RiskLevelOut } from "@/lib/ai/risk";
import { computeSlaDueAt } from "@/lib/escalation/sla";

/**
 * 위기 감지·플래그 server actions (Day 19, PRD §6.3 + §8).
 *
 * - assessAndFlag: 비즈니스 액션 내부에서 sync 호출 — text + source 메타 →
 *   assess_risk → NONE 이면 noop, L1+ 이면 RiskFlag INSERT. 트랜잭션 호환을
 *   위해 prisma client 를 입력으로 받음 (외부 tx 가 있으면 그 안에서 INSERT).
 *   withAuth 데코레이터를 안 쓰는 헬퍼 — 호출 측이 이미 권한 검사됨.
 * - listRiskFlagsForSubject: 본인·담당·운영자 권한별 필터. 상담사 케이스 상세
 *   에서 PENDING flag 표시용.
 * - acknowledgeRiskFlag: 상담사·운영자·전문의가 확인 처리 (D20 escalation 전이).
 */

export interface FlagInput {
  text: string;
  sourceType: RiskSourceType;
  sourceId: string;
  subjectUserId: string;
  companyId?: string | null;
}

export interface FlagResult {
  level: RiskLevelOut;
  riskFlagId: string | null; // NONE 이면 null
  signals: { keywords: string[]; snippet?: string };
  escalationId: string | null; // L3 일 때만 채워짐 (D20 자동 생성)
}

type Tx = Prisma.TransactionClient | typeof prisma;

/**
 * 권한 데코레이터 없는 헬퍼 — 호출 측 (sendAssessmentMessage 등) 이 이미
 * 본인 검증 후 호출. RiskFlag INSERT 는 system 행위로 분류.
 */
export async function assessAndFlag(tx: Tx, input: FlagInput): Promise<FlagResult> {
  const result = await assessRisk(input.text, { sourceType: input.sourceType });

  if (result.level === "NONE") {
    return {
      level: "NONE",
      riskFlagId: null,
      escalationId: null,
      signals: { keywords: result.signals.keywords ?? [], snippet: result.signals.snippet },
    };
  }

  const prismaLevel = toPrismaRiskLevel(result.level);
  if (!prismaLevel) {
    return {
      level: "NONE",
      riskFlagId: null,
      escalationId: null,
      signals: { keywords: result.signals.keywords ?? [], snippet: result.signals.snippet },
    };
  }

  // L3 는 RiskFlag.status 를 즉시 ESCALATED 로 — 운영자 큐에서 "이미 전문의 큐로 이관됨" 표시.
  // L4 는 V1 수동 (PRD §1.3 Out-of-scope), Escalation 자동 생성 안 함 — 화면 안내 + 운영자 즉시 대응.
  const isL3 = result.level === "L3";

  const flag = await tx.riskFlag.create({
    data: {
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      subjectUserId: input.subjectUserId,
      companyId: input.companyId ?? null,
      level: prismaLevel as RiskLevel,
      status: isL3 ? "ESCALATED" : "PENDING",
      signals: result.signals as unknown as Prisma.InputJsonValue,
      summary: result.summary,
    },
    select: { id: true },
  });

  let escalationId: string | null = null;
  if (isL3) {
    const esc = await tx.escalation.create({
      data: {
        riskFlagId: flag.id,
        subjectUserId: input.subjectUserId,
        companyId: input.companyId ?? null,
        slaDueAt: computeSlaDueAt(),
      },
      select: { id: true },
    });
    escalationId = esc.id;
  }

  return {
    level: result.level,
    riskFlagId: flag.id,
    escalationId,
    signals: { keywords: result.signals.keywords ?? [], snippet: result.signals.snippet },
  };
}

export interface RiskFlagRow {
  id: string;
  level: RiskLevel;
  status: string;
  summary: string | null;
  signals: { keywords?: string[]; snippet?: string } | null;
  sourceType: RiskSourceType;
  sourceId: string;
  createdAt: Date;
  acknowledgedAt: Date | null;
}

/** 상담사 케이스 상세에서 사용 — 본인 담당 직원의 PENDING/ACKED flag */
export const listRiskFlagsForSubject = withAuth(
  { action: "read", subject: "RiskAlert" },
  async (
    ctx,
    input: { subjectUserId: string; includeResolved?: boolean },
  ): Promise<RiskFlagRow[]> => {
    // COUNSELOR: 본인 담당 직원만 — booking 으로 확인
    if (ctx.user.role === "COUNSELOR") {
      const hasBooking = await prisma.booking.findFirst({
        where: { counselorId: ctx.user.id, employeeId: input.subjectUserId },
        select: { id: true },
      });
      if (!hasBooking) {
        await prisma.auditLog.create({
          data: {
            actorId: ctx.user.id,
            action: "PERMISSION_DENIED",
            resourceType: "RiskAlert",
            resourceId: input.subjectUserId,
            metadata: { reason: "no booking with subject", at: "listRiskFlagsForSubject" },
          },
        });
        return [];
      }
    }
    // ADMIN: 모든 직원. PSYCHIATRIST: D20 escalation 큐에서 별도 진입.

    const rows = await prisma.riskFlag.findMany({
      where: {
        subjectUserId: input.subjectUserId,
        ...(input.includeResolved
          ? {}
          : { status: { in: ["PENDING", "ACKNOWLEDGED", "ESCALATED"] } }),
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        level: true,
        status: true,
        summary: true,
        signals: true,
        sourceType: true,
        sourceId: true,
        createdAt: true,
        acknowledgedAt: true,
      },
    });

    return rows.map((r) => ({
      id: r.id,
      level: r.level,
      status: r.status,
      summary: r.summary,
      signals: r.signals as { keywords?: string[]; snippet?: string } | null,
      sourceType: r.sourceType,
      sourceId: r.sourceId,
      createdAt: r.createdAt,
      acknowledgedAt: r.acknowledgedAt,
    }));
  },
);

export const acknowledgeRiskFlag = withAuth(
  { action: "read", subject: "RiskAlert" },
  async (
    ctx,
    input: { id: string },
  ): Promise<{ ok: true } | { ok: false; error: string }> => {
    const flag = await prisma.riskFlag.findUnique({
      where: { id: input.id },
      select: { id: true, status: true },
    });
    if (!flag) return { ok: false, error: "위험 플래그를 찾을 수 없습니다." };
    if (flag.status !== "PENDING") {
      return { ok: false, error: "이미 처리된 플래그입니다." };
    }
    await prisma.riskFlag.update({
      where: { id: flag.id },
      data: {
        status: "ACKNOWLEDGED",
        acknowledgedAt: new Date(),
        acknowledgedById: ctx.user.id,
      },
    });
    return { ok: true };
  },
);
