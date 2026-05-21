/**
 * assess_risk Claude tool + Mock provider (Day 19).
 *
 * 모든 세션 메시지·자가진단 응답·임상 노트 finalize 시점에 호출.
 * Mock 은 보수적 키워드 매칭. ANTHROPIC_API_KEY 등록 시 Claude tool_use 로 자동 전환.
 *
 * 위기 레벨 정책 (PRD §8, 기획안 §8):
 *   - L1 NOTICE: 부정 정서, 무기력
 *   - L2 ALERT: 자해·자살 사고 언급
 *   - L3 ESCALATION: 구체적 계획·수단
 *   - L4 EMERGENCY: 즉각 위협 (V1 자동 감지하되 액션은 수동, V2 119 자동)
 */

import { isAIEnabled } from "./client";

export type RiskLevelOut = "NONE" | "L1" | "L2" | "L3" | "L4";

export interface AssessRiskResult {
  level: RiskLevelOut;
  signals: {
    keywords: string[];
    score?: number;
    snippet?: string;
  };
  summary: string;
}

export interface AssessRiskContext {
  sourceType?: "ASSESSMENT_RESPONSE" | "SESSION_MESSAGE" | "CLINICAL_NOTE";
  priorLevel?: RiskLevelOut; // 직전 같은 source 의 level (escalation 판정 보조)
}

// 보수적 키워드 (false negative 보다 false positive 허용)
const L4_KEYWORDS = ["지금 곧", "방금 약을", "지금 죽을", "뛰어내리고 있"];
const L3_KEYWORDS = [
  "뛰어내",
  "수면제 모",
  "유서",
  "약을 모",
  "다리에서",
  "옥상",
  "흉기",
  "목을 매",
];
const L2_KEYWORDS = ["죽고", "자살", "사라지고", "끝내고", "삶을 끝", "자해", "그만 살"];
const L1_KEYWORDS = [
  "우울",
  "무기력",
  "의욕이 없",
  "삶이 무의미",
  "허무",
  "공허",
  "잠을 못",
  "불안",
];

export const assessRiskTool = {
  name: "assess_risk",
  description:
    "메시지·노트 텍스트의 위기 레벨을 평가합니다. NONE/L1/L2/L3/L4 중 하나와 매칭 신호를 반환.",
  input_schema: {
    type: "object" as const,
    properties: {
      level: { type: "string", enum: ["NONE", "L1", "L2", "L3", "L4"] },
      signals: {
        type: "object",
        properties: {
          keywords: { type: "array", items: { type: "string" }, maxItems: 10 },
          score: { type: "number" },
          snippet: { type: "string", maxLength: 200 },
        },
        required: ["keywords"],
      },
      summary: { type: "string", maxLength: 200 },
    },
    required: ["level", "signals", "summary"],
  },
};

export async function assessRiskMock(
  text: string,
  ctx: AssessRiskContext = {},
): Promise<AssessRiskResult> {
  const lower = text;
  const matched: { level: RiskLevelOut; word: string }[] = [];

  for (const k of L4_KEYWORDS) if (lower.includes(k)) matched.push({ level: "L4", word: k });
  for (const k of L3_KEYWORDS) if (lower.includes(k)) matched.push({ level: "L3", word: k });
  for (const k of L2_KEYWORDS) if (lower.includes(k)) matched.push({ level: "L2", word: k });
  for (const k of L1_KEYWORDS) if (lower.includes(k)) matched.push({ level: "L1", word: k });

  const level: RiskLevelOut = matched.length === 0 ? "NONE" : matched[0].level;
  const keywords = matched.map((m) => m.word);

  // snippet: 첫 매칭 키워드 주변 80자
  let snippet: string | undefined;
  if (matched.length > 0) {
    const idx = lower.indexOf(matched[0].word);
    const start = Math.max(0, idx - 40);
    const end = Math.min(lower.length, idx + matched[0].word.length + 40);
    snippet = lower.slice(start, end);
  }

  const summaryByLevel: Record<RiskLevelOut, string> = {
    NONE: "위기 신호 미감지.",
    L1: `부정 정서·무기력 표현 감지 (${keywords.slice(0, 3).join(", ")}). 모니터링 권유.`,
    L2: `자해·자살 사고 표현 감지 (${keywords.slice(0, 3).join(", ")}). 상담사·운영자 즉시 알림 + 핫라인 안내.`,
    L3: `구체적 자해 계획·수단 언급 (${keywords.slice(0, 3).join(", ")}). 24시간 내 전문의 리뷰 권고.`,
    L4: `즉각 위협 표현 (${keywords.slice(0, 3).join(", ")}). 즉시 119·보호자 연락 필요.`,
  };

  return {
    level,
    signals: {
      keywords,
      score: matched.length,
      snippet,
    },
    summary: summaryByLevel[level],
  };
  // ctx.priorLevel 은 mock 에서 미사용 (Claude provider 에서 escalation 판정 보조용으로 전달)
  void ctx;
}

export async function assessRiskClaude(
  text: string,
  ctx: AssessRiskContext = {},
): Promise<AssessRiskResult> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: "claude-opus-4-7", // 위기 감지는 정확도 우선 (PRD §6.3)
    max_tokens: 512,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools: [assessRiskTool] as any,
    tool_choice: { type: "tool", name: "assess_risk" },
    messages: [
      {
        role: "user",
        content:
          `다음 텍스트의 위기 레벨을 보수적으로 평가해 주세요 (false negative 회피 우선).\n` +
          (ctx.sourceType ? `[source: ${ctx.sourceType}]\n` : "") +
          (ctx.priorLevel ? `[직전 같은 source level: ${ctx.priorLevel}]\n` : "") +
          `---\n${text}\n---`,
      },
    ],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use" || toolUse.name !== "assess_risk") {
    throw new Error("[assessRiskClaude] tool_use 응답 누락");
  }
  return toolUse.input as AssessRiskResult;
}

export const assessRisk = isAIEnabled ? assessRiskClaude : assessRiskMock;

// RiskLevelOut → Prisma RiskLevel enum 매핑
const PRISMA_LEVEL_MAP: Record<Exclude<RiskLevelOut, "NONE">, string> = {
  L1: "L1_NOTICE",
  L2: "L2_ALERT",
  L3: "L3_ESCALATION",
  L4: "L4_EMERGENCY",
};

export function toPrismaRiskLevel(level: RiskLevelOut): string | null {
  if (level === "NONE") return null;
  return PRISMA_LEVEL_MAP[level];
}
