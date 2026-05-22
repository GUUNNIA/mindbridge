"use server";

import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/with-auth";
import {
  checkPublishable,
  computeDashboard,
  computeMonthlySeries,
  type DashboardData,
  type MonthlySeriesPoint,
  type PublishGate,
} from "@/lib/hr/aggregate";
import { generateHRInsight, type HRInsightResult } from "@/lib/ai/insight";

/**
 * HR server actions (PRD §6.1.4) — Day 22.
 *
 * 권한:
 *   - HR: can(["read", "manage"], "HRReport")
 *   - ADMIN: manage:all 로 통과
 *
 * 회사 격리: ctx.user.companyId 로 자동 필터. 다른 회사 데이터는 함수 자체가 접근 안 함.
 *
 * BR-7 발행 차단:
 *   회사 직원 수 < 20 그리고 STATISTICS 동의자 < 10 이면 발행 차단.
 *   이때 getDashboard 는 `{ ok: false, gate }` 반환, UI 는 안내 메시지.
 */

export type GetDashboardResult =
  | { ok: true; data: DashboardData; gate: PublishGate }
  | { ok: false; error: string; gate?: PublishGate };

export interface DashboardPeriodInput {
  /** ISO datetime, inclusive */
  startISO: string;
  /** ISO datetime, exclusive */
  endISO: string;
}

function parsePeriod(input: DashboardPeriodInput): { start: Date; end: Date } | null {
  const start = new Date(input.startISO);
  const end = new Date(input.endISO);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  if (start.getTime() >= end.getTime()) return null;
  return { start, end };
}

export const getDashboard = withAuth(
  { action: "read", subject: "HRReport" },
  async (ctx, input: DashboardPeriodInput): Promise<GetDashboardResult> => {
    if (!ctx.user.companyId) {
      return { ok: false, error: "회사 정보가 없는 HR 계정입니다." };
    }
    const period = parsePeriod(input);
    if (!period) {
      return { ok: false, error: "기간 입력이 올바르지 않습니다." };
    }
    const gate = await checkPublishable(prisma, ctx.user.companyId);
    if (!gate.ok) {
      return {
        ok: false,
        error: `발행 조건 미달 (BR-7): 회사 직원 ${gate.headcount}명, 통계 동의자 ${gate.consenters}명. 직원 20명 이상 또는 동의자 10명 이상 필요.`,
        gate,
      };
    }
    const data = await computeDashboard(prisma, {
      companyId: ctx.user.companyId,
      period,
    });
    return { ok: true, data, gate };
  },
);

/**
 * 월별 시계열 (Day 23 추이 차트용).
 * 발행 조건(BR-7) 미달 시 시리즈는 의미 없지만 응답 자체는 0 으로 채워서 반환
 * — UI 가 BR-7 차단 카드로 별도 처리. 본 함수는 모집단 가드(BR-12) 와 셀 마스킹(BR-5)만 강제.
 */
export type GetMonthlySeriesResult =
  | { ok: true; points: MonthlySeriesPoint[] }
  | { ok: false; error: string };

export const getMonthlySeries = withAuth(
  { action: "read", subject: "HRReport" },
  async (
    ctx,
    input: { monthsBack: number },
  ): Promise<GetMonthlySeriesResult> => {
    if (!ctx.user.companyId) {
      return { ok: false, error: "회사 정보가 없는 HR 계정입니다." };
    }
    const monthsBack = Math.min(Math.max(Math.floor(input.monthsBack), 1), 12);
    const points = await computeMonthlySeries(prisma, {
      companyId: ctx.user.companyId,
      monthsBack,
    });
    return { ok: true, points };
  },
);

/**
 * Day 24 — 리포트 미리보기 (인사이트 텍스트만, PDF 는 별도 route handler).
 * BR-7 미달 시 발행 차단.
 */
export type GenerateInsightPreviewResult =
  | { ok: true; data: DashboardData; insight: HRInsightResult; gate: PublishGate }
  | { ok: false; error: string; gate?: PublishGate };

export const generateInsightPreview = withAuth(
  { action: "read", subject: "HRReport" },
  async (
    ctx,
    input: DashboardPeriodInput,
  ): Promise<GenerateInsightPreviewResult> => {
    if (!ctx.user.companyId) {
      return { ok: false, error: "회사 정보가 없는 HR 계정입니다." };
    }
    const period = parsePeriod(input);
    if (!period) {
      return { ok: false, error: "기간 입력이 올바르지 않습니다." };
    }
    const gate = await checkPublishable(prisma, ctx.user.companyId);
    if (!gate.ok) {
      return {
        ok: false,
        error: `발행 조건 미달 (BR-7): 회사 직원 ${gate.headcount}명, 통계 동의자 ${gate.consenters}명. 직원 20명 이상 또는 동의자 10명 이상 필요.`,
        gate,
      };
    }
    const data = await computeDashboard(prisma, {
      companyId: ctx.user.companyId,
      period,
    });
    const insight = await generateHRInsight(data);
    return { ok: true, data, insight, gate };
  },
);
