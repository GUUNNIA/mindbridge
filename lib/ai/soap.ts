/**
 * generate_soap Claude tool + Mock provider (Day 17).
 *
 * ANTHROPIC_API_KEY 가 있으면 real Claude (tool_use 응답), 없으면 결정적 mock.
 * D9 classifyCategory 와 동일 패턴.
 */

import { isAIEnabled } from "./client";

export interface SoapDraft {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  summaryForEmployee: string;
  flags: string[];
}

export interface SoapContext {
  sessionMessages?: { role: "EMPLOYEE" | "COUNSELOR" | "SYSTEM"; content: string }[];
  assessmentSummary?: string | null;
  primaryCategory?: string | null;
  severity?: string | null;
}

const RISK_KEYWORDS = ["죽고", "자살", "사라지고", "끝내고", "뛰어내", "흉기"];
const FAMILY_KEYWORDS = ["가족", "부모", "배우자", "아이"];
const WORK_KEYWORDS = ["회사", "팀장", "상사", "동료", "번아웃"];
const SLEEP_KEYWORDS = ["잠", "불면", "수면"];

const FLAG_VALUES = [
  "RISK_SUICIDAL",
  "RISK_SELF_HARM",
  "FAMILY_CONFLICT",
  "WORK_BURNOUT",
  "SLEEP_DISTURBANCE",
  "FOLLOW_UP_RECOMMENDED",
] as const;
export type SoapFlag = (typeof FLAG_VALUES)[number];

export const generateSoapTool = {
  name: "generate_soap",
  description:
    "상담사 메모와 세션 transcript 를 분석하여 SOAP 형식 임상 노트 초안을 작성합니다.",
  input_schema: {
    type: "object" as const,
    properties: {
      subjective: { type: "string", maxLength: 1200 },
      objective: { type: "string", maxLength: 800 },
      assessment: { type: "string", maxLength: 800 },
      plan: { type: "string", maxLength: 800 },
      summaryForEmployee: { type: "string", maxLength: 400 },
      flags: {
        type: "array",
        items: { type: "string", enum: FLAG_VALUES },
        maxItems: 5,
      },
    },
    required: ["subjective", "objective", "assessment", "plan", "summaryForEmployee", "flags"],
  },
};

function joinTranscript(ctx: SoapContext): string {
  if (!ctx.sessionMessages || ctx.sessionMessages.length === 0) return "";
  return ctx.sessionMessages
    .filter((m) => m.role !== "SYSTEM")
    .map((m) => `${m.role === "EMPLOYEE" ? "내담자" : "상담사"}: ${m.content}`)
    .join("\n");
}

export async function generateSoapMock(
  memo: string,
  ctx: SoapContext = {},
): Promise<SoapDraft> {
  const transcript = joinTranscript(ctx);
  const combined = `${memo}\n${transcript}\n${ctx.assessmentSummary ?? ""}`;

  const flags: SoapFlag[] = [];
  if (RISK_KEYWORDS.some((k) => combined.includes(k))) flags.push("RISK_SUICIDAL");
  if (FAMILY_KEYWORDS.some((k) => combined.includes(k))) flags.push("FAMILY_CONFLICT");
  if (WORK_KEYWORDS.some((k) => combined.includes(k))) flags.push("WORK_BURNOUT");
  if (SLEEP_KEYWORDS.some((k) => combined.includes(k))) flags.push("SLEEP_DISTURBANCE");
  if (ctx.severity === "MODERATELY_SEVERE" || ctx.severity === "SEVERE") {
    flags.push("FOLLOW_UP_RECOMMENDED");
  }

  const memoLine = memo.trim() || "(메모 없음)";
  const categoryNote = ctx.primaryCategory ? ` 1차 분류: ${ctx.primaryCategory}.` : "";
  const severityNote = ctx.severity ? ` 심각도 ${ctx.severity}.` : "";

  return {
    subjective: `내담자는 "${memoLine}" 라고 진술하였다.${ctx.assessmentSummary ? ` 자가진단 요약: ${ctx.assessmentSummary}` : ""}`,
    objective:
      "내담자는 세션 동안 적절한 시선 접촉과 응답 속도를 보였다. 표정·말씨에서 일부 우울·긴장이 관찰되었다.",
    assessment: `상담사 메모와 자가진단을 종합한 임상 인상.${categoryNote}${severityNote} 추가 평가가 필요한 영역: ${flags.includes("RISK_SUICIDAL") ? "자해·자살 사고 (즉시 사정 필요)" : "수면·기분·일상 기능"}.`,
    plan:
      "1) 다음 회기까지 일상 수면·식사·기분 기록을 권유. 2) 인지 재구성 워크시트 1개 제공. 3) 위기 시 핫라인(1577-0199) 안내." +
      (flags.includes("RISK_SUICIDAL") ? " 4) 24시간 내 위기 평가 후속 회기 권유, 가능 시 보호자/안전 계획 점검." : ""),
    summaryForEmployee: `이번 회기는 ${ctx.primaryCategory ?? "주요 호소"} 관련하여 진행되었습니다. 다음 회기까지 수면·기분 기록을 권유드리며, 어려움이 커지면 핫라인(1577-0199)으로 즉시 연락 주세요.`,
    flags,
  };
}

export async function generateSoapClaude(
  memo: string,
  ctx: SoapContext = {},
): Promise<SoapDraft> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const transcript = joinTranscript(ctx);

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools: [generateSoapTool] as any,
    tool_choice: { type: "tool", name: "generate_soap" },
    messages: [
      {
        role: "user",
        content:
          `다음은 상담 회기의 상담사 메모와 세션 transcript 입니다. generate_soap tool 을 호출해 SOAP 형식 노트를 작성해 주세요.\n\n` +
          `[상담사 메모]\n${memo}\n\n` +
          (ctx.assessmentSummary ? `[자가진단 요약]\n${ctx.assessmentSummary}\n\n` : "") +
          (transcript ? `[세션 transcript]\n${transcript}\n` : ""),
      },
    ],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use" || toolUse.name !== "generate_soap") {
    throw new Error("[generateSoapClaude] tool_use 응답 누락");
  }
  return toolUse.input as SoapDraft;
}

export const generateSoap = isAIEnabled ? generateSoapClaude : generateSoapMock;
