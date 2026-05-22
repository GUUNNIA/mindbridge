import { describe, it, expect, vi } from "vitest";

import {
  K_ANON_THRESHOLD,
  BR7_MIN_HEADCOUNT,
  BR7_MIN_CONSENTERS,
  maskCell,
  computeBurnoutRate,
  computeMonthlySeries,
} from "@/lib/hr/aggregate";

/**
 * hr-aggregate.test.ts — D22.
 *
 * 순수 함수 단위 (DB 의존 없음). checkPublishable / computeDashboard
 * 통합 동작은 W4 회귀 E2E (D27) 에서 검증.
 *
 * 핵심 검증:
 *   - k=5 마스킹 경계: 0, 1~4, 5+
 *   - 번아웃 비율: 분자 < k 마스킹, 분모 0 처리, 반올림
 *   - BR-7 / BR-5 상수 값 유지 (회귀 가드)
 */

describe("maskCell — k=5 익명성 마스킹 (BR-5)", () => {
  it("0 은 마스킹하지 않음 (실제 0 과 <5 구분)", () => {
    expect(maskCell(0)).toEqual({ value: 0, masked: false });
  });

  it("1~4 는 마스킹 (UI 는 '<5명' 으로 표시)", () => {
    for (let n = 1; n <= 4; n++) {
      const m = maskCell(n);
      expect(m.masked).toBe(true);
      expect(m.value).toBe(n);
    }
  });

  it("5 부터는 마스킹하지 않음", () => {
    expect(maskCell(5)).toEqual({ value: 5, masked: false });
    expect(maskCell(100)).toEqual({ value: 100, masked: false });
  });
});

describe("computeBurnoutRate — 분자 마스킹 + 반올림", () => {
  it("분모 0 → 0%, 마스킹 없음", () => {
    expect(computeBurnoutRate(0, 0)).toEqual({ value: 0, masked: false });
  });

  it("분자 0 → 0%, 마스킹 없음", () => {
    expect(computeBurnoutRate(0, 100)).toEqual({ value: 0, masked: false });
  });

  it("분자 < k (1~4) → 마스킹 (역추정 차단)", () => {
    expect(computeBurnoutRate(1, 100)).toEqual({ value: 0, masked: true });
    expect(computeBurnoutRate(4, 100)).toEqual({ value: 0, masked: true });
  });

  it("분자 ≥ k → 정수% 반올림", () => {
    expect(computeBurnoutRate(5, 100)).toEqual({ value: 5, masked: false });
    expect(computeBurnoutRate(33, 100)).toEqual({ value: 33, masked: false });
    // 5/8 = 62.5% → 63 (round half to even / round half up 모두 63)
    expect(computeBurnoutRate(5, 8)).toEqual({ value: 63, masked: false });
  });

  it("분자 = 분모 → 100%", () => {
    expect(computeBurnoutRate(10, 10)).toEqual({ value: 100, masked: false });
  });
});

describe("computeMonthlySeries — 월별 추이 (D23)", () => {
  /**
   * 가짜 Prisma 모킹: 모집단 + assessment 데이터를 메모리에서 응답.
   * computeMonthlySeries 의 핵심 동작: 월 버킷 생성, 모집단 필터(BR-12), 셀 마스킹(BR-5).
   */
  function buildFakeDb(opts: {
    consenterIds: string[];
    assessments: Array<{ userId: string; createdAt: Date }>;
  }) {
    return {
      user: {
        findMany: vi.fn(async () =>
          opts.consenterIds.map((id) => ({ id })),
        ),
      },
      assessment: {
        findMany: vi.fn(async (args: { where: { userId: { in: string[] }; createdAt: { gte: Date; lt: Date } } }) => {
          const ids = new Set(args.where.userId.in);
          const start = args.where.createdAt.gte;
          const end = args.where.createdAt.lt;
          return opts.assessments
            .filter((a) => ids.has(a.userId) && a.createdAt >= start && a.createdAt < end)
            .map((a) => ({ createdAt: a.createdAt }));
        }),
      },
    } as unknown as Parameters<typeof computeMonthlySeries>[0];
  }

  it("동의자 0명 → 모든 월 0건, 마스킹 없음", async () => {
    const db = buildFakeDb({ consenterIds: [], assessments: [] });
    const asOf = new Date(Date.UTC(2026, 4, 15)); // 2026-05-15
    const series = await computeMonthlySeries(db, { companyId: "c-1", monthsBack: 3, asOf });
    expect(series).toHaveLength(3);
    expect(series.every((p) => p.assessmentCount.value === 0)).toBe(true);
    expect(series.every((p) => !p.assessmentCount.masked)).toBe(true);
  });

  it("월 버킷 생성: monthsBack=6, asOf=2026-05 → 12월/1월/2월/3월/4월/5월", async () => {
    const db = buildFakeDb({ consenterIds: [], assessments: [] });
    const asOf = new Date(Date.UTC(2026, 4, 15));
    const series = await computeMonthlySeries(db, { companyId: "c-1", monthsBack: 6, asOf });
    expect(series.map((p) => p.monthKey)).toEqual([
      "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05",
    ]);
    expect(series[5].monthLabel).toBe("5월");
  });

  it("월별 응답 수 집계 + k=5 마스킹 — 4건 월은 마스킹, 5건 월은 통과", async () => {
    const ids = ["u1", "u2", "u3", "u4", "u5", "u6"];
    const apr = (d: number) => new Date(Date.UTC(2026, 3, d, 9));
    const may = (d: number) => new Date(Date.UTC(2026, 4, d, 9));
    const db = buildFakeDb({
      consenterIds: ids,
      assessments: [
        // April: 4건 (마스킹)
        { userId: "u1", createdAt: apr(2) },
        { userId: "u2", createdAt: apr(5) },
        { userId: "u3", createdAt: apr(10) },
        { userId: "u4", createdAt: apr(20) },
        // May: 5건 (통과)
        { userId: "u1", createdAt: may(1) },
        { userId: "u2", createdAt: may(3) },
        { userId: "u3", createdAt: may(7) },
        { userId: "u4", createdAt: may(12) },
        { userId: "u5", createdAt: may(15) },
      ],
    });
    const asOf = new Date(Date.UTC(2026, 4, 20));
    const series = await computeMonthlySeries(db, { companyId: "c-1", monthsBack: 2, asOf });

    const april = series.find((p) => p.monthKey === "2026-04");
    const may_ = series.find((p) => p.monthKey === "2026-05");
    expect(april?.assessmentCount).toEqual({ value: 4, masked: true });
    expect(may_?.assessmentCount).toEqual({ value: 5, masked: false });
  });

  it("BR-12 — 모집단 외 user 의 assessment 는 집계에서 제외", async () => {
    const may = (d: number) => new Date(Date.UTC(2026, 4, d, 9));
    const db = buildFakeDb({
      consenterIds: ["u1", "u2"],
      assessments: [
        { userId: "u1", createdAt: may(1) },
        { userId: "u2", createdAt: may(3) },
        // 모집단 외
        { userId: "outsider-1", createdAt: may(5) },
        { userId: "outsider-2", createdAt: may(7) },
      ],
    });
    const asOf = new Date(Date.UTC(2026, 4, 20));
    const series = await computeMonthlySeries(db, { companyId: "c-1", monthsBack: 1, asOf });
    expect(series[0].assessmentCount.value).toBe(2); // outsider 2건 제외
  });
});

describe("상수 회귀 가드 (PRD §7.4 / BR-5 / BR-7)", () => {
  it("K_ANON_THRESHOLD === 5 (BR-5)", () => {
    expect(K_ANON_THRESHOLD).toBe(5);
  });

  it("BR7_MIN_HEADCOUNT === 20", () => {
    expect(BR7_MIN_HEADCOUNT).toBe(20);
  });

  it("BR7_MIN_CONSENTERS === 10", () => {
    expect(BR7_MIN_CONSENTERS).toBe(10);
  });
});
