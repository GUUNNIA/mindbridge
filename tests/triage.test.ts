import { describe, it, expect } from "vitest";
import { assistantReply, shouldComplete, detectCrisis } from "@/lib/ai/triage";

describe("assistantReply — turn별 mock 질문", () => {
  it("turn 0~4 는 정해진 질문 반환", () => {
    expect(assistantReply(0)).toMatch(/힘드신가요/);
    expect(assistantReply(1)).toMatch(/지속/);
    expect(assistantReply(2)).toMatch(/잠/);
    expect(assistantReply(3)).toMatch(/변화/);
  });
  it("turn 범위 초과 시 종합 멘트", () => {
    expect(assistantReply(10)).toMatch(/정리|분류/);
  });
});

describe("shouldComplete — 4턴 이상 + 길이 충족", () => {
  it("3턴 + 짧은 transcript → false", () => {
    expect(shouldComplete(2, "짧은 내용")).toBe(false);
  });
  it("4턴 + 짧은 transcript → false (길이 미충족)", () => {
    expect(shouldComplete(3, "짧음")).toBe(false);
  });
  it("4턴 + 20자 한 줄 한국어 → true (임계 완화)", () => {
    expect(shouldComplete(3, "요즘 잠을 못 자고 매일 불안해서 힘들어요")).toBe(true);
  });
  it("4턴 + 60자 이상 → true", () => {
    expect(shouldComplete(3, "a".repeat(60))).toBe(true);
  });
  it("5턴 + 60자 이상 → true", () => {
    expect(shouldComplete(4, "a".repeat(60))).toBe(true);
  });
  it("hard cap — turn 5 이상이면 길이 무관 true (봇이 정리 멘트만 반복하는 구간)", () => {
    expect(shouldComplete(5, "짧음")).toBe(true);
    expect(shouldComplete(10, "")).toBe(true);
  });
});

describe("detectCrisis — 위기 키워드", () => {
  it("일반 텍스트 false", () => {
    expect(detectCrisis("요즘 좀 우울해요")).toBe(false);
  });
  it("위기 키워드 포함 true", () => {
    expect(detectCrisis("죽고 싶다는 생각이 들어요")).toBe(true);
    expect(detectCrisis("그냥 사라지고 싶어요")).toBe(true);
  });
});
