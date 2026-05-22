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

// ============================================================
// Day 26 — 운영자 위기 큐 (/admin/risk-queue)
// ============================================================

export interface RiskQueueRow {
  id: string;
  level: RiskLevel;
  status: string;
  summary: string | null;
  signals: { keywords?: string[]; snippet?: string } | null;
  sourceType: RiskSourceType;
  sourceId: string;
  subjectUserId: string;
  subjectAnonymizedId: string;
  subjectDepartment: string | null;
  createdAt: Date;
  acknowledgedAt: Date | null;
  acknowledgedByEmail: string | null;
  hasEscalation: boolean;
}

/**
 * 운영자 위기 큐 — 회사 단위 전체 RiskFlag 조회.
 *
 * - ADMIN 만 호출 가능 (manage:all 로 통과).
 * - 회사 격리: ctx.user.companyId 와 RiskFlag.companyId 일치하는 row 만.
 * - 익명성: 직원 이름 노출 안 함. anonymizedId + 부서명만.
 * - 필터: level(L1~L4) / status(PENDING/ACKNOWLEDGED/ESCALATED/RESOLVED/DISMISSED) / 기간.
 * - 정렬: 위험도 우선(L3>L2>L1) + 최신순.
 */
export interface ListRiskQueueInput {
  level?: RiskLevel;
  status?: "PENDING" | "ACKNOWLEDGED" | "ESCALATED" | "RESOLVED" | "DISMISSED";
  fromISO?: string;
  toISO?: string;
  take?: number;
  skip?: number;
}

export interface ListRiskQueueResult {
  rows: RiskQueueRow[];
  total: number;
}

export const listRiskQueue = withAuth(
  { action: "read", subject: "RiskAlert" },
  async (ctx, input: ListRiskQueueInput = {}): Promise<ListRiskQueueResult> => {
    if (ctx.user.role !== "ADMIN") {
      // 운영자 전용 큐 — 다른 롤은 본인 담당만(listRiskFlagsForSubject) 사용
      return { rows: [], total: 0 };
    }
    if (!ctx.user.companyId) return { rows: [], total: 0 };

    const take = Math.min(Math.max(input.take ?? 50, 1), 200);
    const skip = Math.max(input.skip ?? 0, 0);

    const where = {
      companyId: ctx.user.companyId,
      ...(input.level ? { level: input.level } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...((input.fromISO || input.toISO)
        ? {
            createdAt: {
              ...(input.fromISO ? { gte: new Date(input.fromISO) } : {}),
              ...(input.toISO ? { lt: new Date(input.toISO) } : {}),
            },
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.riskFlag.findMany({
        where,
        // 위험도 desc(L3 우선) + 최신순. enum 정렬은 알파벳 따르므로 raw 정렬 효과는 약함 — DB 에서 status·createdAt 만 정렬하고 화면에서 보충.
        orderBy: [{ createdAt: "desc" }],
        take,
        skip,
        include: {
          subject: {
            select: {
              anonymizedId: true,
              department: { select: { name: true } },
            },
          },
          acknowledgedBy: { select: { email: true } },
          escalation: { select: { id: true } },
        },
      }),
      prisma.riskFlag.count({ where }),
    ]);

    return {
      rows: rows.map((r) => ({
        id: r.id,
        level: r.level,
        status: r.status,
        summary: r.summary,
        signals: r.signals as { keywords?: string[]; snippet?: string } | null,
        sourceType: r.sourceType,
        sourceId: r.sourceId,
        subjectUserId: r.subjectUserId,
        subjectAnonymizedId: r.subject.anonymizedId,
        subjectDepartment: r.subject.department?.name ?? null,
        createdAt: r.createdAt,
        acknowledgedAt: r.acknowledgedAt,
        acknowledgedByEmail: r.acknowledgedBy?.email ?? null,
        hasEscalation: !!r.escalation,
      })),
      total,
    };
  },
);

/**
 * Day 26 — 운영자 dismiss (false positive 처리). 사유 입력 필수 (PRD §A1 AC3).
 * AuditLog 기록.
 */
export const dismissRiskFlag = withAuth(
  { action: "update", subject: "RiskAlert" },
  async (
    ctx,
    input: { id: string; reason: string },
  ): Promise<{ ok: true } | { ok: false; error: string }> => {
    if (ctx.user.role !== "ADMIN") {
      return { ok: false, error: "운영자 권한이 필요합니다." };
    }
    const reason = input.reason.trim();
    if (reason.length < 5) {
      return { ok: false, error: "디스미스 사유는 5자 이상 입력해 주세요." };
    }
    const flag = await prisma.riskFlag.findUnique({
      where: { id: input.id },
      select: { id: true, status: true, companyId: true },
    });
    if (!flag) return { ok: false, error: "위험 플래그를 찾을 수 없습니다." };
    if (flag.companyId && flag.companyId !== ctx.user.companyId) {
      await prisma.auditLog.create({
        data: {
          actorId: ctx.user.id,
          action: "PERMISSION_DENIED",
          resourceType: "RiskAlert",
          resourceId: input.id,
          metadata: { reason: "cross-company dismiss", at: "dismissRiskFlag" },
        },
      });
      return { ok: false, error: "다른 회사 플래그는 처리할 수 없습니다." };
    }
    if (flag.status === "DISMISSED" || flag.status === "RESOLVED") {
      return { ok: false, error: "이미 종결된 플래그입니다." };
    }

    await prisma.$transaction([
      prisma.riskFlag.update({
        where: { id: flag.id },
        data: {
          status: "DISMISSED",
          dismissReason: reason,
          acknowledgedAt: new Date(),
          acknowledgedById: ctx.user.id,
        },
      }),
      prisma.auditLog.create({
        data: {
          actorId: ctx.user.id,
          action: "DISMISS_RISK_FLAG",
          resourceType: "RiskAlert",
          resourceId: flag.id,
          metadata: { reason },
        },
      }),
    ]);
    return { ok: true };
  },
);
