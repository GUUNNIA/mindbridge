/**
 * generate_hr_insight Claude tool + Mock provider (Day 24).
 *
 * ANTHROPIC_API_KEY 가 있으면 real Claude (tool_use), 없으면 결정적 mock.
 * D9 (classify) / D17 (SOAP) / D19 (assess_risk) 동일 패턴.
 *
 * 입력: DashboardData (현재 기간 집계) + 전월 비교 (선택).
 * 출력: 1단락 인사이트 + Key Takeaways 3 + Recommended Actions 3.
 *
 * **익명성 가드**: mock·real 모두 개인 식별 가능 문자열을 출력하지 않음.
 *   - 입력의 카테고리/심각도/부서명/숫자만 사용
 *   - 마스킹 셀(masked=true)은 비율 산정·인용에서 제외
 */

import { isAIEnabled } from "./client";
import type { DashboardData } from "@/lib/hr/aggregate";

export interface HRInsightResult {
  insightParagraph: string;
  keyTakeaways: string[];
  recommendedActions: string[];
}

export const generateHRInsightTool = {
  name: "generate_hr_insight",
  description:
    "기업 EAP 익명 집계 지표를 분석하여 HR 임원 보고용 1단락 인사이트와 Key Takeaways·Recommended Actions 를 작성합니다. 개인 식별 정보는 절대 출력하지 않습니다.",
  input_schema: {
    type: "object" as const,
    properties: {
      insightParagraph: { type: "string", maxLength: 600 },
      keyTakeaways: {
        type: "array",
        items: { type: "string", maxLength: 160 },
        minItems: 3,
        maxItems: 3,
      },
      recommendedActions: {
        type: "array",
        items: { type: "string", maxLength: 160 },
        minItems: 3,
        maxItems: 3,
      },
    },
    required: ["insightParagraph", "keyTakeaways", "recommendedActions"],
  },
};

// ============================================================
// 입력 정리 — mask 된 셀은 인용 후보에서 제외
// ============================================================

interface SummarizedInput {
  topCategoryName: string | null;
  topCategoryCount: number;
  totalAssessments: number;
  participationRate: number; // 0..100, 통계 동의자 대비 활성 사용자 비율
  burnoutRatePercent: number | null; // masked 면 null
  severeRatio: number | null; // SEVERE + MODERATELY_SEVERE 비율 (마스킹 셀 제외)
  hasMaskedDepartments: boolean;
}

export function summarizeForInsight(data: DashboardData): SummarizedInput {
  const visibleCategories = data.categoryDistribution.filter((c) => !c.count.masked);
  const top = visibleCategories[0] ?? null;
  const totalVisible = visibleCategories.reduce((s, c) => s + c.count.value, 0);

  const participation =
    data.statisticsConsenters > 0 && !data.activeAssessmentUsers.masked
      ? Math.round((data.activeAssessmentUsers.value / data.statisticsConsenters) * 100)
      : 0;

  const burnoutRate = data.burnoutRatePercent.masked
    ? null
    : data.burnoutRatePercent.value;

  const severeSum = data.severityDistribution
    .filter((s) => !s.count.masked && (s.severity === "SEVERE" || s.severity === "MODERATELY_SEVERE"))
    .reduce((acc, s) => acc + s.count.value, 0);
  const totalSeverityVisible = data.severityDistribution
    .filter((s) => !s.count.masked)
    .reduce((acc, s) => acc + s.count.value, 0);
  const severeRatio = totalSeverityVisible > 0
    ? Math.round((severeSum / totalSeverityVisible) * 100)
    : null;

  return {
    topCategoryName: top?.name ?? null,
    topCategoryCount: top?.count.value ?? 0,
    totalAssessments: totalVisible,
    participationRate: participation,
    burnoutRatePercent: burnoutRate,
    severeRatio,
    hasMaskedDepartments: data.byDepartment.some((d) => d.activeAssessmentUsers.masked),
  };
}

// ============================================================
// Mock provider — 결정적 템플릿
// ============================================================

export async function generateHRInsightMock(data: DashboardData): Promise<HRInsightResult> {
  const s = summarizeForInsight(data);

  const paragraphParts: string[] = [];
  paragraphParts.push(`최근 기간 통계 동의자 ${data.statisticsConsenters}명 중 ${data.activeAssessmentUsers.masked ? "<5명" : `${data.activeAssessmentUsers.value}명`}이 자가진단을 이용하여 참여율은 ${s.participationRate}%입니다.`);
  if (s.topCategoryName) {
    paragraphParts.push(`가장 빈도가 높은 주제는 ${s.topCategoryName}(${s.topCategoryCount}회)입니다.`);
  }
  if (s.burnoutRatePercent !== null && s.burnoutRatePercent > 0) {
    paragraphParts.push(`번아웃 카테고리 비중은 ${s.burnoutRatePercent}%로, 직무 소진 관련 신호가 확인됩니다.`);
  }
  if (s.severeRatio !== null && s.severeRatio > 20) {
    paragraphParts.push(`중증 이상 심각도가 전체의 ${s.severeRatio}%로 다소 높습니다. 후속 케어 강화가 필요합니다.`);
  } else if (s.severeRatio !== null) {
    paragraphParts.push(`중증 이상 비중은 ${s.severeRatio}%로 안정 범위입니다.`);
  }
  paragraphParts.push("본 집계는 k≥5 익명성 가드와 STATISTICS 동의자 모집단 기준이며 개인 식별 정보는 포함되지 않습니다.");

  const keyTakeaways: string[] = [
    s.topCategoryName
      ? `이번 기간 핵심 주제는 ${s.topCategoryName} (${s.topCategoryCount}회)`
      : "기간 내 유의미한 카테고리 신호 없음",
    s.burnoutRatePercent !== null
      ? `번아웃 비중 ${s.burnoutRatePercent}% — ${s.burnoutRatePercent > 15 ? "조직 차원 점검 권장" : "안정 추세 유지"}`
      : "번아웃 셀 마스킹 — 표본 부족",
    s.severeRatio !== null
      ? `중증 이상 비율 ${s.severeRatio}% — ${s.severeRatio > 20 ? "후속 케어 우선" : "표준 추적"}`
      : "심각도 셀 마스킹 — 표본 부족",
  ];

  const recommendedActions: string[] = [
    s.topCategoryName
      ? `${s.topCategoryName} 관련 사내 워크숍·자기돌봄 캠페인 1건 운영`
      : "전사 사내 캠페인 1건 운영 (분기 단위)",
    s.burnoutRatePercent !== null && s.burnoutRatePercent > 15
      ? "관리자 대상 번아웃 인식·예방 가이드 배포"
      : "분기별 EAP 이용 안내 메일 재발송",
    s.hasMaskedDepartments
      ? "5명 미만 부서는 익명성 보호를 위해 별도 집계 — 부서장 1:1 면담 권장"
      : "부서장 대상 EAP 활용 사례 공유 세션 1회 실시",
  ];

  return {
    insightParagraph: paragraphParts.join(" "),
    keyTakeaways,
    recommendedActions,
  };
}

// ============================================================
// Real Claude provider
// ============================================================

export async function generateHRInsightClaude(data: DashboardData): Promise<HRInsightResult> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const safeInput = sanitizeInputForLLM(data);

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools: [generateHRInsightTool] as any,
    tool_choice: { type: "tool", name: "generate_hr_insight" },
    messages: [
      {
        role: "user",
        content:
          `다음은 한국 기업 EAP 의 익명 집계 지표입니다. generate_hr_insight tool 을 호출해 임원 보고용 인사이트를 작성해 주세요.\n\n` +
          `**필수 제약**:\n` +
          `- 개인 식별 정보 절대 출력 금지 (이름·부서원 식별 등)\n` +
          `- 마스킹된 셀은 인용·계산에서 제외\n` +
          `- 한국어, 1단락 200자 이내, Key Takeaways/Actions 각 3건 (160자 이내)\n\n` +
          `[지표]\n${JSON.stringify(safeInput, null, 2)}`,
      },
    ],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use" || toolUse.name !== "generate_hr_insight") {
    throw new Error("[generateHRInsightClaude] tool_use 응답 누락");
  }
  return toolUse.input as HRInsightResult;
}

function sanitizeInputForLLM(data: DashboardData) {
  return {
    totalEmployees: data.totalEmployees,
    statisticsConsenters: data.statisticsConsenters,
    activeAssessmentUsers: data.activeAssessmentUsers.masked ? null : data.activeAssessmentUsers.value,
    assessmentCount: data.assessmentCount.masked ? null : data.assessmentCount.value,
    burnoutRatePercent: data.burnoutRatePercent.masked ? null : data.burnoutRatePercent.value,
    categoryDistribution: data.categoryDistribution
      .filter((c) => !c.count.masked)
      .map((c) => ({ name: c.name, count: c.count.value })),
    severityDistribution: data.severityDistribution
      .filter((s) => !s.count.masked)
      .map((s) => ({ severity: s.severity, count: s.count.value })),
    byDepartment: data.byDepartment.map((d) => ({
      name: d.name,
      headcount: d.headcount,
      activeAssessmentUsers: d.activeAssessmentUsers.masked ? null : d.activeAssessmentUsers.value,
    })),
  };
}

export const generateHRInsight = isAIEnabled
  ? generateHRInsightClaude
  : generateHRInsightMock;
