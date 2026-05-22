import { describe, it, expect } from "vitest";

import {
  K_ANON_THRESHOLD,
  BR7_MIN_HEADCOUNT,
  BR7_MIN_CONSENTERS,
  maskCell,
  computeBurnoutRate,
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
