import { describe, it, expect } from "vitest";
import {
  classifyCategoryMock,
  classifyCategoryTool,
  provider,
} from "@/lib/ai/client";

describe("classifyCategoryMock — 결정적 키워드 분류", () => {
  it("같은 입력 → 같은 결과 (재현 가능)", async () => {
    const a = await classifyCategoryMock("요즘 잠을 못 자고 불안해요. 너무 힘들어요.");
    const b = await classifyCategoryMock("요즘 잠을 못 자고 불안해요. 너무 힘들어요.");
    expect(a).toEqual(b);
  });

  it("'우울/무기력' → primaryCategory=depression", async () => {
    const r = await classifyCategoryMock("요즘 너무 우울하고 의욕도 없어요. 무기력합니다.");
    expect(r.primaryCategory).toBe("depression");
  });

  it("'잠/수면' → primaryCategory=sleep", async () => {
    const r = await classifyCategoryMock("매일 잠을 못 자요. 불면이 너무 심해요. 수면이 무너졌어요.");
    expect(r.primaryCategory).toBe("sleep");
  });

  it("'번아웃/회사/일' → primaryCategory=burnout", async () => {
    const r = await classifyCategoryMock("번아웃 같아요. 회사 일이 너무 많고 매일 지쳐요.");
    expect(r.primaryCategory).toBe("burnout");
  });

  it("키워드 미매칭 시 fallback=depression", async () => {
    const r = await classifyCategoryMock("그냥");
    expect(r.primaryCategory).toBe("depression");
  });

  it("위기 키워드 → severity=SEVERE", async () => {
    const r = await classifyCategoryMock("자살 생각이 들어요. 사라지고 싶어요.");
    expect(r.severity).toBe("SEVERE");
  });

  it("intensifier 0개 + 짧은 텍스트 → severity 약함", async () => {
    const r = await classifyCategoryMock("우울해요");
    expect(["NONE", "MILD"]).toContain(r.severity);
  });

  it("긴 텍스트 + intensifier 2개 → 심각도 상승", async () => {
    const r = await classifyCategoryMock(
      "정말 너무 심해요. 매번 우울하고 의욕도 없어요. " + "a".repeat(200),
    );
    expect(["MODERATE", "MODERATELY_SEVERE", "SEVERE"]).toContain(r.severity);
  });

  it("summary 두 종류 모두 채워짐", async () => {
    const r = await classifyCategoryMock("요즘 잠을 못 자요");
    expect(r.summaryForCounselor.length).toBeGreaterThan(0);
    expect(r.summaryForEmployee.length).toBeGreaterThan(0);
  });
});

describe("classify_category tool schema", () => {
  it("required 필드 5종 모두 정의됨", () => {
    expect(classifyCategoryTool.input_schema.required).toEqual(
      expect.arrayContaining([
        "primaryCategory",
        "secondaryCategories",
        "severity",
        "summaryForCounselor",
        "summaryForEmployee",
      ]),
    );
  });
});

describe("provider", () => {
  it("ANTHROPIC_API_KEY 없으면 mock", () => {
    // vitest 는 환경변수 격리 안 함, .env 의 실제 값에 의존.
    // Day 9 mock 모드를 가정. 키 등록 후 이 단언은 의도적으로 깨질 것 → 그때 갱신.
    if (!process.env.ANTHROPIC_API_KEY) {
      expect(provider).toBe("mock");
    }
  });
});
