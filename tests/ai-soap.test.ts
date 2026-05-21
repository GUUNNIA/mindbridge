import { describe, it, expect } from "vitest";

import { generateSoapMock, generateSoapTool } from "@/lib/ai/soap";

describe("generateSoapMock — 결정적 SOAP 초안", () => {
  it("기본 메모 → 4 fields + summary + flags 모두 채워짐", async () => {
    const r = await generateSoapMock("내담자가 수면 부족·업무 압박 호소");
    expect(r.subjective.length).toBeGreaterThan(0);
    expect(r.objective.length).toBeGreaterThan(0);
    expect(r.assessment.length).toBeGreaterThan(0);
    expect(r.plan.length).toBeGreaterThan(0);
    expect(r.summaryForEmployee.length).toBeGreaterThan(0);
  });

  it("같은 입력 → 같은 출력 (mock 결정성)", async () => {
    const memo = "메모 동일 입력 테스트";
    const a = await generateSoapMock(memo);
    const b = await generateSoapMock(memo);
    expect(a).toEqual(b);
  });

  it("자살 키워드 → RISK_SUICIDAL flag", async () => {
    const r = await generateSoapMock("내담자가 죽고 싶다는 표현을 반복함");
    expect(r.flags).toContain("RISK_SUICIDAL");
    expect(r.plan).toContain("위기 평가");
  });

  it("가족 키워드 → FAMILY_CONFLICT flag", async () => {
    const r = await generateSoapMock("내담자가 부모와의 갈등을 토로");
    expect(r.flags).toContain("FAMILY_CONFLICT");
  });

  it("회사 키워드 → WORK_BURNOUT flag", async () => {
    const r = await generateSoapMock("회사 일이 너무 많아 번아웃 상태");
    expect(r.flags).toContain("WORK_BURNOUT");
  });

  it("심각도 SEVERE → FOLLOW_UP_RECOMMENDED flag", async () => {
    const r = await generateSoapMock("메모", { severity: "SEVERE" });
    expect(r.flags).toContain("FOLLOW_UP_RECOMMENDED");
  });

  it("자가진단 요약 컨텍스트 → S field 에 포함", async () => {
    const r = await generateSoapMock("메모", {
      assessmentSummary: "1차 분류: 우울. MILD.",
    });
    expect(r.subjective).toContain("자가진단 요약");
  });

  it("자살 키워드 없음 → RISK_SUICIDAL 미포함", async () => {
    const r = await generateSoapMock("일상적 스트레스 보고");
    expect(r.flags).not.toContain("RISK_SUICIDAL");
  });
});

describe("generate_soap tool schema", () => {
  it("required 필드 6종 정의됨", () => {
    expect(generateSoapTool.input_schema.required).toEqual(
      expect.arrayContaining([
        "subjective",
        "objective",
        "assessment",
        "plan",
        "summaryForEmployee",
        "flags",
      ]),
    );
  });
});
