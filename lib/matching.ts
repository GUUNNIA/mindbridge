import type { Counselor, CounselorAvailability, CounselorCategory } from "@prisma/client";

/**
 * 매칭 가중치 (PRD BR-4, 합계 100):
 *   - 카테고리 일치 40 (primary 강한 매칭 30, secondary 일치 +10)
 *   - 평점 20 (rating 0~5 → 0~20 선형)
 *   - 가용시간 20 (다음 7일 내 슬롯 있으면 만점)
 *   - 다양성 (주니어 노출) 10 (JUNIOR 10, SENIOR 5, SUPERVISOR 0)
 *   - 신규 매칭 보정 10 (해당 직원과 이전 booking 없으면 만점)
 *
 * BR-11(같은 회사 라이센스 보유자 회피) 은 V1 시드 한계로 보류 — 단, 본인은 제외.
 *
 * 출력 score 는 0..100. 동점 시 평점 → tier(JUNIOR 우선) → id 순.
 */

const W_CATEGORY_PRIMARY = 30;
const W_CATEGORY_SECONDARY = 10;
const W_RATING_MAX = 20;
const W_AVAILABILITY = 20;
const W_DIVERSITY_MAX = 10;
const W_NEW_MATCH = 10;

export interface ScoreInput {
  primaryCategoryId: string | null;
  secondaryCategoryIds: string[];
  counselor: Counselor & {
    categories: CounselorCategory[];
    availability: CounselorAvailability[];
  };
  hasPriorBookingWithEmployee: boolean;
  windowDays?: number; // 가용시간 평가 윈도 (default 7)
}

export interface ScoreBreakdown {
  category: number;
  rating: number;
  availability: number;
  diversity: number;
  newMatch: number;
  total: number;
}

export function scoreCounselor(input: ScoreInput): ScoreBreakdown {
  const { primaryCategoryId, secondaryCategoryIds, counselor, hasPriorBookingWithEmployee } =
    input;
  const windowDays = input.windowDays ?? 7;

  const categorySet = new Set(counselor.categories.map((c) => c.categoryId));

  // 카테고리
  let categoryScore = 0;
  if (primaryCategoryId && categorySet.has(primaryCategoryId)) {
    categoryScore += W_CATEGORY_PRIMARY;
  }
  if (secondaryCategoryIds.length > 0) {
    const matchedSecondary = secondaryCategoryIds.filter((id) => categorySet.has(id)).length;
    if (matchedSecondary > 0) {
      // secondary 1개 이상 매칭 시 10 만점, 비례 안 함 (단순화)
      categoryScore += W_CATEGORY_SECONDARY;
    }
  }
  categoryScore = Math.min(categoryScore, W_CATEGORY_PRIMARY + W_CATEGORY_SECONDARY);

  // 평점
  const ratingScore = counselor.rating
    ? Math.min((counselor.rating / 5) * W_RATING_MAX, W_RATING_MAX)
    : 0;

  // 가용시간
  const availabilityScore = hasAvailabilityInWindow(counselor.availability, windowDays)
    ? W_AVAILABILITY
    : 0;

  // 다양성 (주니어 노출)
  const diversityScore =
    counselor.tier === "JUNIOR"
      ? W_DIVERSITY_MAX
      : counselor.tier === "SENIOR"
        ? W_DIVERSITY_MAX / 2
        : 0;

  // 신규 매칭 보정
  const newMatchScore = hasPriorBookingWithEmployee ? 0 : W_NEW_MATCH;

  const total =
    categoryScore + ratingScore + availabilityScore + diversityScore + newMatchScore;

  return {
    category: categoryScore,
    rating: ratingScore,
    availability: availabilityScore,
    diversity: diversityScore,
    newMatch: newMatchScore,
    total,
  };
}

/** recurring 또는 명시 가용 슬롯이 windowDays 안에 존재하면 true. */
export function hasAvailabilityInWindow(
  availability: CounselorAvailability[],
  windowDays: number,
): boolean {
  if (availability.length === 0) return false;
  // recurring=true 가 있으면 매주 반복이라 windowDays 안에 무조건 있음.
  if (availability.some((a) => a.recurring)) return true;
  // 비반복 슬롯은 명시 시각 확인.
  const now = Date.now();
  const horizon = now + windowDays * 24 * 60 * 60 * 1000;
  return availability.some(
    (a) => !a.recurring && a.startsAt.getTime() >= now && a.startsAt.getTime() <= horizon,
  );
}

export interface RankedCounselor {
  counselor: ScoreInput["counselor"];
  score: ScoreBreakdown;
  reasonText: string;
}

/**
 * 정렬: total DESC → rating DESC → tier 우선(JUNIOR>SENIOR>SUPERVISOR) → id ASC.
 */
export function rankCounselors(
  pool: Array<{
    counselor: ScoreInput["counselor"];
    hasPriorBookingWithEmployee: boolean;
  }>,
  primaryCategoryId: string | null,
  secondaryCategoryIds: string[],
  windowDays?: number,
): RankedCounselor[] {
  const tierOrder: Record<string, number> = { JUNIOR: 0, SENIOR: 1, SUPERVISOR: 2 };

  const ranked = pool.map(({ counselor, hasPriorBookingWithEmployee }) => {
    const score = scoreCounselor({
      primaryCategoryId,
      secondaryCategoryIds,
      counselor,
      hasPriorBookingWithEmployee,
      windowDays,
    });
    return { counselor, score, reasonText: buildReason(counselor, score) };
  });

  ranked.sort((a, b) => {
    if (b.score.total !== a.score.total) return b.score.total - a.score.total;
    const rA = a.counselor.rating ?? 0;
    const rB = b.counselor.rating ?? 0;
    if (rB !== rA) return rB - rA;
    const tA = tierOrder[a.counselor.tier] ?? 99;
    const tB = tierOrder[b.counselor.tier] ?? 99;
    if (tA !== tB) return tA - tB;
    return a.counselor.id.localeCompare(b.counselor.id);
  });

  return ranked;
}

function buildReason(
  counselor: ScoreInput["counselor"],
  score: ScoreBreakdown,
): string {
  const parts: string[] = [];
  if (score.category >= W_CATEGORY_PRIMARY) parts.push("주요 카테고리 일치");
  else if (score.category > 0) parts.push("관련 카테고리 일치");
  if (counselor.rating && counselor.rating >= 4.5) parts.push(`평점 ${counselor.rating.toFixed(1)}`);
  if (score.diversity === W_DIVERSITY_MAX) parts.push("신규 노출 우대");
  if (score.newMatch === W_NEW_MATCH) parts.push("처음 매칭");
  if (parts.length === 0) parts.push(`경력 ${counselor.yearsOfPractice}년`);
  return parts.join(" · ");
}
