import type { Severity } from "@prisma/client";

/**
 * Anthropic Claude 클라이언트 wrapper.
 *
 * ANTHROPIC_API_KEY 가 환경변수에 있으면 real Claude 호출,
 * 없으면 결정적 mock provider (Day 9~ 학습 단계에서 결제 부담 회피).
 *
 * 인터페이스는 동일하므로 후일 키만 채우면 real API 로 자동 전환.
 */

export const isAIEnabled = !!process.env.ANTHROPIC_API_KEY;
export type Provider = "claude" | "mock";
export const provider: Provider = isAIEnabled ? "claude" : "mock";

export type CategorySlug =
  | "depression"
  | "anxiety"
  | "burnout"
  | "sleep"
  | "relationships"
  | "family"
  | "grief"
  | "addiction";

export interface ClassifyCategoryResult {
  primaryCategory: CategorySlug;
  secondaryCategories: CategorySlug[];
  severity: Severity;
  summaryForCounselor: string;
  summaryForEmployee: string;
}

// ============================================================
// classify_category — tool 정의
// ============================================================

const CATEGORY_SLUGS: CategorySlug[] = [
  "depression",
  "anxiety",
  "burnout",
  "sleep",
  "relationships",
  "family",
  "grief",
  "addiction",
];

const SEVERITY_VALUES: Severity[] = ["NONE", "MILD", "MODERATE", "MODERATELY_SEVERE", "SEVERE"];

export const classifyCategoryTool = {
  name: "classify_category",
  description:
    "사용자 자가진단 transcript 를 분석하여 1차/2차 카테고리·심각도·상담사용/직원용 요약을 반환합니다.",
  input_schema: {
    type: "object" as const,
    properties: {
      primaryCategory: { type: "string", enum: CATEGORY_SLUGS },
      secondaryCategories: {
        type: "array",
        items: { type: "string", enum: CATEGORY_SLUGS },
        maxItems: 2,
      },
      severity: { type: "string", enum: SEVERITY_VALUES },
      summaryForCounselor: { type: "string", maxLength: 600 },
      summaryForEmployee: { type: "string", maxLength: 400 },
    },
    required: [
      "primaryCategory",
      "secondaryCategories",
      "severity",
      "summaryForCounselor",
      "summaryForEmployee",
    ],
  },
};

// ============================================================
// Mock provider — 결정적 키워드·길이 기반
// ============================================================

const KEYWORDS: Record<CategorySlug, string[]> = {
  depression: ["우울", "무기력", "의욕", "삶이 무의미", "기쁘지", "허무"],
  anxiety: ["불안", "공황", "긴장", "초조", "두근", "걱정"],
  burnout: ["번아웃", "지쳐", "탈진", "일이 너무", "퇴근", "회사"],
  sleep: ["잠", "수면", "불면", "잠들기", "꿈"],
  relationships: ["상사", "동료", "팀장", "관계", "사람"],
  family: ["가족", "부모", "배우자", "아이", "남편", "아내"],
  grief: ["사별", "이별", "잃었", "상실", "돌아가"],
  addiction: ["술", "알코올", "게임", "스마트폰", "중독"],
};

const CRISIS_KEYWORDS = ["죽고", "자살", "사라지고", "끝내고"];

function scoreCategories(text: string): { primary: CategorySlug; secondaries: CategorySlug[] } {
  const scores = new Map<CategorySlug, number>();
  for (const [slug, words] of Object.entries(KEYWORDS) as [CategorySlug, string[]][]) {
    const hits = words.filter((w) => text.includes(w)).length;
    if (hits > 0) scores.set(slug, hits);
  }
  if (scores.size === 0) {
    return { primary: "depression", secondaries: [] };
  }
  const sorted = [...scores.entries()].sort(([, a], [, b]) => b - a);
  return {
    primary: sorted[0][0],
    secondaries: sorted.slice(1, 3).map(([s]) => s),
  };
}

function pickSeverity(text: string): Severity {
  if (CRISIS_KEYWORDS.some((k) => text.includes(k))) return "SEVERE";
  const intensifiers = ["심해", "너무", "매번", "계속", "전혀", "도저히"];
  const hits = intensifiers.filter((k) => text.includes(k)).length;
  if (hits >= 2 || text.length > 300) return "MODERATELY_SEVERE";
  if (hits >= 1 || text.length > 150) return "MODERATE";
  if (text.length > 60) return "MILD";
  return "NONE";
}

const CATEGORY_NAMES_KO: Record<CategorySlug, string> = {
  depression: "우울",
  anxiety: "불안",
  burnout: "번아웃",
  sleep: "수면",
  relationships: "직장 관계",
  family: "가족",
  grief: "상실·애도",
  addiction: "중독·의존",
};

export async function classifyCategoryMock(transcript: string): Promise<ClassifyCategoryResult> {
  const { primary, secondaries } = scoreCategories(transcript);
  const severity = pickSeverity(transcript);
  return {
    primaryCategory: primary,
    secondaryCategories: secondaries,
    severity,
    summaryForCounselor: `[mock 분류] 1차: ${CATEGORY_NAMES_KO[primary]} / 심각도: ${severity}. transcript 길이 ${transcript.length}자, 키워드 매칭 기반. 실제 임상 분류 아님 — Anthropic API key 등록 시 Claude 호출로 대체됩니다.`,
    summaryForEmployee: `자가진단을 통해 ${CATEGORY_NAMES_KO[primary]} 카테고리가 가장 가까워 보입니다. 심각도는 ${severity} 수준입니다. 보다 정확한 평가를 위해 상담사와의 대화를 권장드립니다.`,
  };
}

// ============================================================
// Real Claude provider — Day 9 mock 모드, 키 등록 시 자동 전환
// ============================================================

export async function classifyCategoryClaude(transcript: string): Promise<ClassifyCategoryResult> {
  // 동적 import 로 SDK 가 mock 경로에서 평가되지 않게 함.
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // SDK 타입과의 충돌은 mock-only 단계에서 의미 없음 — API key 등록 후 활성화 시 정식 타이핑.
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools: [classifyCategoryTool] as any,
    tool_choice: { type: "tool", name: "classify_category" },
    messages: [
      {
        role: "user",
        content: `다음은 자가진단 챗봇 transcript 입니다. classify_category tool 을 호출해 분류해 주세요.\n\n---\n${transcript}\n---`,
      },
    ],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use" || toolUse.name !== "classify_category") {
    throw new Error("[classifyCategoryClaude] tool_use 응답 누락");
  }
  return toolUse.input as ClassifyCategoryResult;
}

export const classifyCategory = isAIEnabled
  ? classifyCategoryClaude
  : classifyCategoryMock;
