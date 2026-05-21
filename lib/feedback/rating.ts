/**
 * Counselor 평점 집계 (D21).
 *
 * 단순 평균 — (rating * ratingCount + newRating) / (ratingCount + 1).
 * 부동소수 누적 오차는 1000회 이내 평점 수에선 무의미 (PRD §6.1.1 V1 단순화).
 *
 * 트랜잭션 안에서 호출되는 헬퍼 — DB 접근 없는 순수 함수로 분리해 단위 테스트.
 */

export interface RatingAggregate {
  rating: number;
  ratingCount: number;
}

export function applyNewRating(
  current: { rating: number | null; ratingCount: number },
  newRating: number,
): RatingAggregate {
  if (!Number.isInteger(newRating) || newRating < 1 || newRating > 5) {
    throw new Error(`[rating] newRating must be 1~5 integer, got ${newRating}`);
  }
  const prevAvg = current.rating ?? 0;
  const prevCount = current.ratingCount;
  const nextCount = prevCount + 1;
  const nextAvg = (prevAvg * prevCount + newRating) / nextCount;
  // 소수점 2자리 — Counselor.rating 은 Float 이므로 디스플레이 일관성만 보장
  return {
    rating: Math.round(nextAvg * 100) / 100,
    ratingCount: nextCount,
  };
}
