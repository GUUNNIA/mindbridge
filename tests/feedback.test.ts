import { describe, it, expect } from "vitest";

import { applyNewRating } from "@/lib/feedback/rating";

/**
 * feedback.test.ts — D21.
 *
 * Counselor 평점 집계 순수 함수 검증 (DB 의존 없음).
 * submitFeedback 통합 동작은 W3 회귀 E2E 에서.
 */

describe("applyNewRating — 평균·카운트 누적", () => {
  it("최초 평점 (rating=null) → 평균 = 새 평점, count = 1", () => {
    const r = applyNewRating({ rating: null, ratingCount: 0 }, 4);
    expect(r).toEqual({ rating: 4, ratingCount: 1 });
  });

  it("기존 평균 4.5 (count=2) + 새 평점 3 → 평균 4 (count=3)", () => {
    const r = applyNewRating({ rating: 4.5, ratingCount: 2 }, 3);
    expect(r.rating).toBe(4);
    expect(r.ratingCount).toBe(3);
  });

  it("기존 평균 4.8 (count=48) + 새 평점 5 → 평균 4.8 (소수점 2자리 반올림)", () => {
    const r = applyNewRating({ rating: 4.8, ratingCount: 48 }, 5);
    expect(r.rating).toBeCloseTo(4.8, 1);
    expect(r.ratingCount).toBe(49);
  });

  it("정확한 평균: 3.0 (count=1) + 4 → 3.5 (count=2)", () => {
    const r = applyNewRating({ rating: 3, ratingCount: 1 }, 4);
    expect(r).toEqual({ rating: 3.5, ratingCount: 2 });
  });

  it("1~5 범위 밖 평점 throw — 0", () => {
    expect(() => applyNewRating({ rating: null, ratingCount: 0 }, 0)).toThrow(/1~5/);
  });

  it("1~5 범위 밖 평점 throw — 6", () => {
    expect(() => applyNewRating({ rating: null, ratingCount: 0 }, 6)).toThrow(/1~5/);
  });

  it("정수 아닌 평점 throw — 3.5", () => {
    expect(() => applyNewRating({ rating: null, ratingCount: 0 }, 3.5)).toThrow(/1~5/);
  });

  it("소수점 2자리로 반올림 — 평균이 4.333... → 4.33", () => {
    // (5 + 4 + 4) / 3 = 4.333...
    let agg: { rating: number | null; ratingCount: number } = { rating: null, ratingCount: 0 };
    for (const n of [5, 4, 4]) {
      const next = applyNewRating(agg, n);
      agg = { rating: next.rating, ratingCount: next.ratingCount };
    }
    expect(agg.rating).toBe(4.33);
    expect(agg.ratingCount).toBe(3);
  });

  it("연속 누적 100회 후에도 평균 유지 (모두 5점 → 5.0)", () => {
    let agg: { rating: number | null; ratingCount: number } = { rating: null, ratingCount: 0 };
    for (let i = 0; i < 100; i++) {
      const next = applyNewRating(agg, 5);
      agg = { rating: next.rating, ratingCount: next.ratingCount };
    }
    expect(agg.rating).toBe(5);
    expect(agg.ratingCount).toBe(100);
  });
});
