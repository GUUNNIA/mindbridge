import { describe, it, expect } from "vitest";
import { scoreCounselor, rankCounselors, hasAvailabilityInWindow } from "@/lib/matching";

// 헬퍼 — 최소한의 Counselor 객체 생성 (타입은 Prisma generated 와 호환)
function makeCounselor(opts: {
  id: string;
  tier: "JUNIOR" | "SENIOR" | "SUPERVISOR";
  rating: number | null;
  yearsOfPractice?: number;
  categoryIds?: string[];
  hasRecurringAvailability?: boolean;
}) {
  return {
    id: opts.id,
    userId: `u-${opts.id}`,
    tier: opts.tier,
    bio: "",
    yearsOfPractice: opts.yearsOfPractice ?? 5,
    rating: opts.rating,
    ratingCount: 10,
    approvedAt: new Date(),
    approvedById: "admin-1",
    suspendedAt: null,
    suspendReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    categories: (opts.categoryIds ?? []).map((categoryId) => ({
      counselorId: opts.id,
      categoryId,
      createdAt: new Date(),
    })),
    availability: opts.hasRecurringAvailability
      ? [
          {
            id: `av-${opts.id}`,
            counselorId: opts.id,
            startsAt: new Date(),
            endsAt: new Date(),
            recurring: true,
            dayOfWeek: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]
      : [],
  };
}

describe("scoreCounselor — BR-4 가중치 합산", () => {
  it("완벽 매칭(primary + secondary + 평점 5 + recurring + JUNIOR + 신규) → 100점", () => {
    const c = makeCounselor({
      id: "c1",
      tier: "JUNIOR",
      rating: 5,
      categoryIds: ["cat-primary", "cat-second"],
      hasRecurringAvailability: true,
    });
    const s = scoreCounselor({
      primaryCategoryId: "cat-primary",
      secondaryCategoryIds: ["cat-second"],
      counselor: c,
      hasPriorBookingWithEmployee: false,
    });
    expect(s.category).toBe(40);
    expect(s.rating).toBe(20);
    expect(s.availability).toBe(20);
    expect(s.diversity).toBe(10);
    expect(s.newMatch).toBe(10);
    expect(s.total).toBe(100);
  });

  it("카테고리 미일치 + 평점 4.5 + recurring + SENIOR + 재매칭 → 4.5*4 + 20 + 5 + 0 = 43", () => {
    const c = makeCounselor({
      id: "c2",
      tier: "SENIOR",
      rating: 4.5,
      categoryIds: ["other"],
      hasRecurringAvailability: true,
    });
    const s = scoreCounselor({
      primaryCategoryId: "cat-primary",
      secondaryCategoryIds: ["cat-second"],
      counselor: c,
      hasPriorBookingWithEmployee: true,
    });
    expect(s.category).toBe(0);
    expect(s.rating).toBe(18); // 4.5/5 * 20
    expect(s.availability).toBe(20);
    expect(s.diversity).toBe(5);
    expect(s.newMatch).toBe(0);
    expect(s.total).toBe(43);
  });

  it("primary 일치만 (secondary 없음) → category=30", () => {
    const c = makeCounselor({
      id: "c3",
      tier: "SUPERVISOR",
      rating: 4,
      categoryIds: ["cat-primary"],
      hasRecurringAvailability: true,
    });
    const s = scoreCounselor({
      primaryCategoryId: "cat-primary",
      secondaryCategoryIds: [],
      counselor: c,
      hasPriorBookingWithEmployee: false,
    });
    expect(s.category).toBe(30);
    expect(s.diversity).toBe(0); // SUPERVISOR
  });

  it("rating null → rating 점수 0", () => {
    const c = makeCounselor({
      id: "c4",
      tier: "JUNIOR",
      rating: null,
      categoryIds: [],
      hasRecurringAvailability: true,
    });
    const s = scoreCounselor({
      primaryCategoryId: null,
      secondaryCategoryIds: [],
      counselor: c,
      hasPriorBookingWithEmployee: false,
    });
    expect(s.rating).toBe(0);
  });

  it("가용 슬롯 없음 → availability 0", () => {
    const c = makeCounselor({
      id: "c5",
      tier: "JUNIOR",
      rating: 4,
      hasRecurringAvailability: false,
    });
    const s = scoreCounselor({
      primaryCategoryId: null,
      secondaryCategoryIds: [],
      counselor: c,
      hasPriorBookingWithEmployee: false,
    });
    expect(s.availability).toBe(0);
  });
});

describe("rankCounselors — 정렬", () => {
  it("total DESC, 동점 시 rating DESC", () => {
    const pool = [
      { counselor: makeCounselor({ id: "low", tier: "SUPERVISOR", rating: 4, hasRecurringAvailability: true }), hasPriorBookingWithEmployee: false },
      { counselor: makeCounselor({ id: "mid", tier: "SENIOR", rating: 4.5, categoryIds: ["P"], hasRecurringAvailability: true }), hasPriorBookingWithEmployee: false },
      { counselor: makeCounselor({ id: "top", tier: "JUNIOR", rating: 5, categoryIds: ["P"], hasRecurringAvailability: true }), hasPriorBookingWithEmployee: false },
    ];
    const r = rankCounselors(pool, "P", []);
    expect(r[0].counselor.id).toBe("top");
    expect(r[1].counselor.id).toBe("mid");
    expect(r[2].counselor.id).toBe("low");
  });

  it("동점 시 JUNIOR > SENIOR > SUPERVISOR", () => {
    const pool = [
      { counselor: makeCounselor({ id: "sup", tier: "SUPERVISOR", rating: 4, categoryIds: ["P"], hasRecurringAvailability: true }), hasPriorBookingWithEmployee: false },
      { counselor: makeCounselor({ id: "jr", tier: "JUNIOR", rating: 4, categoryIds: ["P"], hasRecurringAvailability: true }), hasPriorBookingWithEmployee: false },
    ];
    const r = rankCounselors(pool, "P", []);
    // JUNIOR 는 diversity 10 더 받으므로 total 더 높음
    expect(r[0].counselor.id).toBe("jr");
  });
});

describe("hasAvailabilityInWindow", () => {
  it("recurring=true 하나라도 있으면 true", () => {
    expect(
      hasAvailabilityInWindow(
        [
          {
            id: "a",
            counselorId: "c",
            startsAt: new Date(0),
            endsAt: new Date(0),
            recurring: true,
            dayOfWeek: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        7,
      ),
    ).toBe(true);
  });

  it("availability 비어있으면 false", () => {
    expect(hasAvailabilityInWindow([], 7)).toBe(false);
  });
});
