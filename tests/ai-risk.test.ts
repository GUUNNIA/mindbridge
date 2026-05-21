import { describe, it, expect } from "vitest";

import { assessRiskMock, assessRiskTool, toPrismaRiskLevel } from "@/lib/ai/risk";

describe("assessRiskMock — 보수적 키워드 위기 평가", () => {
  it("위기 키워드 0개 → NONE", async () => {
    const r = await assessRiskMock("오늘은 평범한 하루였어요. 회사 점심 맛있었습니다.");
    expect(r.level).toBe("NONE");
    expect(r.signals.keywords).toEqual([]);
  });

  it("L1: 부정 정서 키워드 → L1_NOTICE", async () => {
    const r = await assessRiskMock("요즘 너무 우울하고 무기력해요. 의욕이 없어요.");
    expect(r.level).toBe("L1");
    expect(r.signals.keywords.length).toBeGreaterThan(0);
  });

  it("L2: 자살 사고 키워드 → L2_ALERT (직원 핫라인 노출 트리거)", async () => {
    const r = await assessRiskMock("그냥 사라지고 싶다는 생각이 자주 들어요.");
    expect(r.level).toBe("L2");
    expect(r.summary).toContain("핫라인");
  });

  it("L3: 구체적 계획·수단 키워드 → L3_ESCALATION", async () => {
    const r = await assessRiskMock("수면제를 모아두기 시작했어요. 옥상에 자주 갑니다.");
    expect(r.level).toBe("L3");
    expect(r.summary).toMatch(/전문의|24/);
  });

  it("L4: 즉각 위협 키워드 → L4_EMERGENCY", async () => {
    const r = await assessRiskMock("지금 곧 끝낼 거예요.");
    expect(r.level).toBe("L4");
  });

  it("같은 텍스트 → 같은 결과 (mock 결정성)", async () => {
    const text = "요즘 자살 생각이 자주 들어요";
    const a = await assessRiskMock(text);
    const b = await assessRiskMock(text);
    expect(a).toEqual(b);
  });

  it("높은 레벨이 낮은 레벨보다 우선 (L3 키워드 + L1 키워드 동시)", async () => {
    const r = await assessRiskMock("우울하고 무기력해요. 그리고 뛰어내릴 곳을 찾고 있어요.");
    expect(r.level).toBe("L3");
  });

  it("signals.snippet 은 매칭 키워드 주변 80자 context 포함", async () => {
    const r = await assessRiskMock(
      "오랜만에 친구를 만났는데 우울한 기분이 들었습니다. 그 후로 일이 손에 안 잡혀요.",
    );
    expect(r.level).toBe("L1");
    expect(r.signals.snippet).toBeDefined();
    expect(r.signals.snippet?.length).toBeLessThanOrEqual(200);
  });
});

describe("toPrismaRiskLevel — RiskLevelOut → Prisma enum", () => {
  it("NONE → null (RiskFlag 미생성 신호)", () => {
    expect(toPrismaRiskLevel("NONE")).toBe(null);
  });
  it("L1 → L1_NOTICE", () => {
    expect(toPrismaRiskLevel("L1")).toBe("L1_NOTICE");
  });
  it("L2 → L2_ALERT", () => {
    expect(toPrismaRiskLevel("L2")).toBe("L2_ALERT");
  });
  it("L3 → L3_ESCALATION", () => {
    expect(toPrismaRiskLevel("L3")).toBe("L3_ESCALATION");
  });
  it("L4 → L4_EMERGENCY", () => {
    expect(toPrismaRiskLevel("L4")).toBe("L4_EMERGENCY");
  });
});

describe("assess_risk tool schema", () => {
  it("required 필드 3종 (level/signals/summary)", () => {
    expect(assessRiskTool.input_schema.required).toEqual(
      expect.arrayContaining(["level", "signals", "summary"]),
    );
  });
});
