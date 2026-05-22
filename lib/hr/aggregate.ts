/**
 * HR 익명 집계 + k-anon 가드 + BR-7 발행 조건 (Day 22).
 *
 * 단일 모듈 정책:
 *   HR 의 모든 집계 server action(`getDashboard`, D24 `generateMonthlyReport`)
 *   은 이 파일의 함수만 거쳐서 응답한다. 차트(D23)·PDF(D24)도 동일.
 *
 * 가드 3종:
 *   1) BR-5: k≥5 — 셀 카운트 < 5 면 `masked: true` 로 마스킹. UI 는 "<5명" 표시.
 *   2) BR-7: 발행 조건 — 회사 직원 수 ≥20 또는 STATISTICS 동의자 ≥10. 미달 시
 *      computeDashboard 는 호출 자체가 의미 없음 → 호출 측에서 checkPublishable
 *      먼저 검증하고 거절. 본 모듈은 발행 가능한 상태를 전제로 동작.
 *   3) BR-12: STATISTICS 미동의 직원은 모집단에서 제외. statisticsConsenterUserIds
 *      집합 안에서만 집계.
 *
 * 시간대: DB는 UTC, 함수 인자도 UTC Date 가정. UI 표시는 호출 측 KST 변환.
 */

import type { Severity } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

export const K_ANON_THRESHOLD = 5;
export const BR7_MIN_HEADCOUNT = 20;
export const BR7_MIN_CONSENTERS = 10;
export const BURNOUT_CATEGORY_SLUG = "burnout";

export interface DashboardPeriod {
  /** inclusive */
  start: Date;
  /** exclusive */
  end: Date;
}

/**
 * k-anon 마스킹된 셀. masked=true 면 value 는 표시용으로 사용 금지
 * (UI 는 "<5명" 등으로 표현). 원본 카운트는 디버깅 목적의 raw 만 노출.
 */
export interface KMasked {
  value: number;
  masked: boolean;
}

export interface CategoryCount {
  slug: string;
  name: string;
  count: KMasked;
}

export interface SeverityCount {
  severity: Severity;
  count: KMasked;
}

export interface DepartmentMetric {
  departmentId: string;
  name: string;
  headcount: number; // 부서 인원 (식별성 없음 — 회사 단위 공개 정보로 취급)
  activeAssessmentUsers: KMasked;
}

export interface DashboardData {
  /** 집계 모집단 메타 (k-anon 가드 대상 아님 — 회사 단위 공개) */
  totalEmployees: number;
  statisticsConsenters: number;

  /** 기간 내 자가진단 1회 이상 + STATISTICS 동의 직원 수 */
  activeAssessmentUsers: KMasked;
  /** 기간 내 자가진단 응답 수 (STATISTICS 동의자 한정) */
  assessmentCount: KMasked;

  /** 자가진단 primary 카테고리 분포 (STATISTICS 동의자 한정) */
  categoryDistribution: CategoryCount[];
  /** 자가진단 심각도 분포 (STATISTICS 동의자 한정, COMPLETED 만) */
  severityDistribution: SeverityCount[];
  /** 번아웃 비율 (burnout primary / 전체 primary) — 분자/분모 모두 k 가드 통과 시에만 값 */
  burnoutRatePercent: KMasked;

  /** 부서별 집계 (부서 인원 < 5 면 cell 도 마스킹) */
  byDepartment: DepartmentMetric[];

  /** 집계 시점 (UTC) */
  computedAt: Date;
}

export type PublishGate =
  | { ok: true; headcount: number; consenters: number }
  | {
      ok: false;
      reason: "INSUFFICIENT_HEADCOUNT_AND_CONSENTERS";
      headcount: number;
      consenters: number;
    };

/**
 * 단일 셀 k-anon 마스킹.
 * - 0 은 마스킹 대상 아님 (실제 데이터가 0인 경우와 5명 미만을 구분).
 *   PRD §H1 AC3: k<5 셀만 "<5명"으로. 0은 0으로 노출.
 * - 0 < n < K_ANON_THRESHOLD → masked
 */
export function maskCell(n: number): KMasked {
  if (n === 0) return { value: 0, masked: false };
  if (n < K_ANON_THRESHOLD) return { value: n, masked: true };
  return { value: n, masked: false };
}

/**
 * BR-7 발행 조건 검증.
 * - 회사 직원 수 ≥ 20명: 헤드카운트만으로 통과
 * - STATISTICS 동의자 ≥ 10명: 동의자 수만으로 통과
 * - 둘 다 미달이면 발행 차단
 *
 * "직원 수" 는 회사 소속 EMPLOYEE 롤 ACTIVE 사용자.
 */
export async function checkPublishable(
  db: PrismaClient,
  companyId: string,
): Promise<PublishGate> {
  const [headcount, consenters] = await Promise.all([
    db.user.count({
      where: { companyId, role: "EMPLOYEE", status: "ACTIVE", deletedAt: null },
    }),
    countStatisticsConsenters(db, companyId),
  ]);

  if (headcount >= BR7_MIN_HEADCOUNT || consenters >= BR7_MIN_CONSENTERS) {
    return { ok: true, headcount, consenters };
  }
  return {
    ok: false,
    reason: "INSUFFICIENT_HEADCOUNT_AND_CONSENTERS",
    headcount,
    consenters,
  };
}

/**
 * STATISTICS 동의자 user.id 목록 (회사 단위, 현재 시점 기준 active 동의).
 * BR-12: 미동의자는 HR 집계 모집단에서 제외.
 */
export async function listStatisticsConsenterUserIds(
  db: PrismaClient,
  companyId: string,
): Promise<string[]> {
  const rows = await db.user.findMany({
    where: {
      companyId,
      role: "EMPLOYEE",
      status: "ACTIVE",
      deletedAt: null,
      consents: {
        some: { type: "STATISTICS", revokedAt: null },
      },
    },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

async function countStatisticsConsenters(
  db: PrismaClient,
  companyId: string,
): Promise<number> {
  return db.user.count({
    where: {
      companyId,
      role: "EMPLOYEE",
      status: "ACTIVE",
      deletedAt: null,
      consents: { some: { type: "STATISTICS", revokedAt: null } },
    },
  });
}

/**
 * 대시보드 집계. 호출 측에서 checkPublishable 통과를 확인한 다음 호출할 것.
 * 발행 조건 미달 상태에서 호출하면 모집단이 작아 거의 모든 셀이 마스킹된다.
 */
export async function computeDashboard(
  db: PrismaClient,
  args: { companyId: string; period: DashboardPeriod },
): Promise<DashboardData> {
  const { companyId, period } = args;

  const [totalEmployees, consenterIds] = await Promise.all([
    db.user.count({
      where: { companyId, role: "EMPLOYEE", status: "ACTIVE", deletedAt: null },
    }),
    listStatisticsConsenterUserIds(db, companyId),
  ]);
  const statisticsConsenters = consenterIds.length;

  // 모집단이 비면 빠른 종료 (전부 0)
  if (consenterIds.length === 0) {
    return emptyDashboard(totalEmployees, statisticsConsenters);
  }

  const periodFilter = { gte: period.start, lt: period.end };

  // 활성 자가진단 사용자: 동의자 ∩ 기간 내 Assessment 보유자
  const activeUserRows = await db.assessment.findMany({
    where: {
      userId: { in: consenterIds },
      createdAt: periodFilter,
    },
    select: { userId: true },
    distinct: ["userId"],
  });
  const activeAssessmentUsers = activeUserRows.length;

  const assessmentCount = await db.assessment.count({
    where: { userId: { in: consenterIds }, createdAt: periodFilter },
  });

  // 카테고리 분포 (primaryCategoryId 기반, COMPLETED 한정)
  const completedAssessments = await db.assessment.findMany({
    where: {
      userId: { in: consenterIds },
      createdAt: periodFilter,
      status: "COMPLETED",
      primaryCategoryId: { not: null },
    },
    select: { primaryCategoryId: true, severity: true },
  });

  const categoryCountMap = new Map<string, number>();
  const severityCountMap = new Map<Severity, number>();
  for (const a of completedAssessments) {
    if (a.primaryCategoryId) {
      categoryCountMap.set(
        a.primaryCategoryId,
        (categoryCountMap.get(a.primaryCategoryId) ?? 0) + 1,
      );
    }
    if (a.severity) {
      severityCountMap.set(
        a.severity,
        (severityCountMap.get(a.severity) ?? 0) + 1,
      );
    }
  }

  const categories = await db.category.findMany({
    where: { id: { in: [...categoryCountMap.keys()] } },
    select: { id: true, slug: true, name: true },
  });
  const categoryDistribution: CategoryCount[] = categories
    .map((c) => ({
      slug: c.slug,
      name: c.name,
      count: maskCell(categoryCountMap.get(c.id) ?? 0),
    }))
    .sort((a, b) => b.count.value - a.count.value);

  const ALL_SEVERITIES: Severity[] = [
    "NONE",
    "MILD",
    "MODERATE",
    "MODERATELY_SEVERE",
    "SEVERE",
  ];
  const severityDistribution: SeverityCount[] = ALL_SEVERITIES.map((s) => ({
    severity: s,
    count: maskCell(severityCountMap.get(s) ?? 0),
  }));

  // 번아웃 비율: burnout primary 카운트 / 전체 primary 카운트
  const burnoutCat = categories.find((c) => c.slug === BURNOUT_CATEGORY_SLUG);
  const totalPrimary = completedAssessments.length;
  const burnoutCount = burnoutCat
    ? categoryCountMap.get(burnoutCat.id) ?? 0
    : 0;
  const burnoutRatePercent = computeBurnoutRate(burnoutCount, totalPrimary);

  // 부서별 (부서 헤드카운트 + 활성 사용자)
  const byDepartment = await computeByDepartment(
    db,
    companyId,
    consenterIds,
    periodFilter,
  );

  return {
    totalEmployees,
    statisticsConsenters,
    activeAssessmentUsers: maskCell(activeAssessmentUsers),
    assessmentCount: maskCell(assessmentCount),
    categoryDistribution,
    severityDistribution,
    burnoutRatePercent,
    byDepartment,
    computedAt: new Date(),
  };
}

function emptyDashboard(
  totalEmployees: number,
  statisticsConsenters: number,
): DashboardData {
  return {
    totalEmployees,
    statisticsConsenters,
    activeAssessmentUsers: { value: 0, masked: false },
    assessmentCount: { value: 0, masked: false },
    categoryDistribution: [],
    severityDistribution: [],
    burnoutRatePercent: { value: 0, masked: false },
    byDepartment: [],
    computedAt: new Date(),
  };
}

/**
 * 번아웃 비율(%). 분자가 k 미만이면 마스킹. 분모 0 이면 0%.
 * 비율은 정수% 로 반올림 (소수점 절단으로 식별성 회피).
 */
export function computeBurnoutRate(numerator: number, denominator: number): KMasked {
  if (denominator === 0) return { value: 0, masked: false };
  // 분자가 k 미만이면 비율 자체를 마스킹 (역추정으로 개인 식별 차단)
  if (numerator > 0 && numerator < K_ANON_THRESHOLD) {
    return { value: 0, masked: true };
  }
  const pct = Math.round((numerator / denominator) * 100);
  return { value: pct, masked: false };
}

/**
 * 월별 시계열 (Day 23 추이 차트용).
 *
 * - period 의 [start, end) 를 UTC 월 경계로 잘라서 각 월별 응답 수 집계.
 * - 모집단: STATISTICS 동의자 ∩ EMPLOYEE ACTIVE.
 * - 셀별 k=5 마스킹 — 월별 응답 수가 1~4 면 마스킹 (차트는 0 으로 그리되 raw value 분리).
 *
 * 시드와 정합: D23 시드가 최근 5개월에 분산되어 있다면 약 10건/월. k 마스킹 발생 빈도 낮음.
 */
export interface MonthlySeriesPoint {
  /** 월 시작 (UTC) */
  monthStart: Date;
  /** "2026-05" 같은 키 (정렬·차트 X축용) */
  monthKey: string;
  /** "5월" 같은 표시명 (한국어, KST 기준 동일 — UTC/KST 월 경계는 9시간 차이라 월 단위는 거의 동일) */
  monthLabel: string;
  /** 해당 월 자가진단 응답 수 (k 마스킹 적용) */
  assessmentCount: KMasked;
}

export async function computeMonthlySeries(
  db: PrismaClient,
  args: {
    companyId: string;
    /** 이번 달 포함, 몇 개월 전까지 (예: 6 → 최근 6개월) */
    monthsBack: number;
    /** 기준 시점, default = new Date() */
    asOf?: Date;
  },
): Promise<MonthlySeriesPoint[]> {
  const { companyId, monthsBack } = args;
  const asOf = args.asOf ?? new Date();

  const consenterIds = await listStatisticsConsenterUserIds(db, companyId);
  if (consenterIds.length === 0) {
    return buildMonthBuckets(asOf, monthsBack).map((b) => ({
      ...b,
      assessmentCount: { value: 0, masked: false },
    }));
  }

  const buckets = buildMonthBuckets(asOf, monthsBack);
  const seriesStart = buckets[0].monthStart;
  const seriesEnd = new Date(
    Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() + 1, 1, 0, 0, 0, 0),
  );

  const rows = await db.assessment.findMany({
    where: {
      userId: { in: consenterIds },
      createdAt: { gte: seriesStart, lt: seriesEnd },
    },
    select: { createdAt: true },
  });

  const counts = new Map<string, number>();
  for (const r of rows) {
    const key = monthKeyOf(r.createdAt);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return buckets.map((b) => ({
    ...b,
    assessmentCount: maskCell(counts.get(b.monthKey) ?? 0),
  }));
}

function buildMonthBuckets(
  asOf: Date,
  monthsBack: number,
): Array<{ monthStart: Date; monthKey: string; monthLabel: string }> {
  const buckets: Array<{ monthStart: Date; monthKey: string; monthLabel: string }> = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const monthStart = new Date(
      Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() - i, 1, 0, 0, 0, 0),
    );
    buckets.push({
      monthStart,
      monthKey: monthKeyOf(monthStart),
      monthLabel: `${monthStart.getUTCMonth() + 1}월`,
    });
  }
  return buckets;
}

function monthKeyOf(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

async function computeByDepartment(
  db: PrismaClient,
  companyId: string,
  consenterIds: string[],
  periodFilter: { gte: Date; lt: Date },
): Promise<DepartmentMetric[]> {
  const departments = await db.department.findMany({
    where: { companyId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const result: DepartmentMetric[] = [];
  for (const d of departments) {
    const headcount = await db.user.count({
      where: {
        companyId,
        departmentId: d.id,
        role: "EMPLOYEE",
        status: "ACTIVE",
        deletedAt: null,
      },
    });
    // 부서 헤드카운트가 k 미만이면 활성 사용자도 자동으로 k 미만이므로 셀 마스킹.
    if (headcount < K_ANON_THRESHOLD) {
      result.push({
        departmentId: d.id,
        name: d.name,
        headcount,
        activeAssessmentUsers: { value: 0, masked: true },
      });
      continue;
    }

    const activeRows = await db.assessment.findMany({
      where: {
        userId: { in: consenterIds },
        createdAt: periodFilter,
        user: { departmentId: d.id },
      },
      select: { userId: true },
      distinct: ["userId"],
    });
    result.push({
      departmentId: d.id,
      name: d.name,
      headcount,
      activeAssessmentUsers: maskCell(activeRows.length),
    });
  }
  return result;
}
