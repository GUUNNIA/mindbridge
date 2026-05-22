import { describe, it, expect } from "vitest";

import { generateHRInsightMock, summarizeForInsight } from "@/lib/ai/insight";
import type { DashboardData } from "@/lib/hr/aggregate";

/**
 * ai-insight.test.ts — D24.
 *
 * generateHRInsightMock 의 결정적 동작 + 마스킹 셀 제외 가드.
 */

function buildData(overrides: Partial<DashboardData> = {}): DashboardData {
  return {
    totalEmployees: 50,
    statisticsConsenters: 40,
    activeAssessmentUsers: { value: 30, masked: false },
    assessmentCount: { value: 54, masked: false },
    categoryDistribution: [
      { slug: "depression", name: "우울", count: { value: 12, masked: false } },
      { slug: "anxiety", name: "불안", count: { value: 12, masked: false } },
      { slug: "burnout", name: "번아웃", count: { value: 12, masked: false } },
      { slug: "sleep", name: "수면", count: { value: 6, masked: false } },
      { slug: "relationships", name: "직장 관계", count: { value: 12, masked: false } },
    ],
    severityDistribution: [
      { severity: "NONE", count: { value: 0, masked: false } },
      { severity: "MILD", count: { value: 19, masked: false } },
      { severity: "MODERATE", count: { value: 18, masked: false } },
      { severity: "MODERATELY_SEVERE", count: { value: 12, masked: false } },
      { severity: "SEVERE", count: { value: 5, masked: false } },
    ],
    burnoutRatePercent: { value: 22, masked: false },
    byDepartment: [],
    computedAt: new Date(),
    ...overrides,
  };
}

describe("summarizeForInsight — 마스킹 셀 제외", () => {
  it("기본 케이스 — top 카테고리·참여율·번아웃 추출", () => {
    const s = summarizeForInsight(buildData());
    expect(s.topCategoryName).toBe("우울");
    expect(s.topCategoryCount).toBe(12);
    expect(s.participationRate).toBe(75); // 30/40 = 75%
    expect(s.burnoutRatePercent).toBe(22);
    expect(s.totalAssessments).toBe(54);
  });

  it("burnout 마스킹 시 null", () => {
    const s = summarizeForInsight(
      buildData({ burnoutRatePercent: { value: 0, masked: true } }),
    );
    expect(s.burnoutRatePercent).toBeNull();
  });

  it("activeAssessmentUsers 마스킹 시 참여율 0", () => {
    const s = summarizeForInsight(
      buildData({ activeAssessmentUsers: { value: 3, masked: true } }),
    );
    expect(s.participationRate).toBe(0);
  });

  it("severity 마스킹 셀은 비율 계산에서 제외", () => {
    const s = summarizeForInsight(
      buildData({
        severityDistribution: [
          { severity: "NONE", count: { value: 0, masked: false } },
          { severity: "MILD", count: { value: 10, masked: false } },
          { severity: "MODERATE", count: { value: 10, masked: false } },
          { severity: "MODERATELY_SEVERE", count: { value: 3, masked: true } }, // 제외
          { severity: "SEVERE", count: { value: 5, masked: false } },
        ],
      }),
    );
    // 가시 합계 25 중 SEVERE 5 / MODERATELY_SEVERE 마스킹 → 5/25 = 20%
    expect(s.severeRatio).toBe(20);
  });

  it("hasMaskedDepartments — 마스킹 부서 있음 감지", () => {
    const s = summarizeForInsight(
      buildData({
        byDepartment: [
          {
            departmentId: "d1",
            name: "기획팀",
            headcount: 3,
            activeAssessmentUsers: { value: 0, masked: true },
          },
          {
            departmentId: "d2",
            name: "개발팀",
            headcount: 20,
            activeAssessmentUsers: { value: 12, masked: false },
          },
        ],
      }),
    );
    expect(s.hasMaskedDepartments).toBe(true);
  });
});

describe("generateHRInsightMock — 결정적 출력 + 스키마 정합", () => {
  it("기본 케이스 — 1단락 + Key Takeaways 3 + Actions 3", async () => {
    const r = await generateHRInsightMock(buildData());
    expect(r.insightParagraph).toMatch(/통계 동의자/);
    expect(r.insightParagraph).toMatch(/우울/);
    expect(r.keyTakeaways).toHaveLength(3);
    expect(r.recommendedActions).toHaveLength(3);
    // 항목 길이 제한 (PDF 가독성)
    for (const t of [...r.keyTakeaways, ...r.recommendedActions]) {
      expect(t.length).toBeLessThanOrEqual(160);
    }
  });

  it("번아웃 마스킹 케이스 — 마스킹 인지 메시지", async () => {
    const r = await generateHRInsightMock(
      buildData({ burnoutRatePercent: { value: 0, masked: true } }),
    );
    expect(r.keyTakeaways.some((t) => t.includes("마스킹"))).toBe(true);
  });

  it("개인 식별 가능 문자열 없음 — 익명성 회귀 가드", async () => {
    const r = await generateHRInsightMock(buildData());
    const all = [r.insightParagraph, ...r.keyTakeaways, ...r.recommendedActions].join(" ");
    // 닉네임 / 이메일 / phone 패턴이 들어가지 않음
    expect(all).not.toMatch(/@/);
    expect(all).not.toMatch(/\d{3}-\d{3,4}-\d{4}/);
    // 시드 닉네임 "직원-" 등이 우연히 들어가지 않음
    expect(all).not.toMatch(/직원-\d+/);
  });

  it("마스킹 부서 있음 → Action 에 익명성 보호 안내 포함", async () => {
    const r = await generateHRInsightMock(
      buildData({
        byDepartment: [
          {
            departmentId: "d1",
            name: "기획팀",
            headcount: 3,
            activeAssessmentUsers: { value: 0, masked: true },
          },
        ],
      }),
    );
    expect(r.recommendedActions.some((a) => a.includes("5명 미만"))).toBe(true);
  });
});
