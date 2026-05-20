import { describe, it, expect } from "vitest";
import { expandRecurringSlots, groupSlotsByDay } from "@/lib/booking";

// 헬퍼 — 시드와 동일한 패턴의 CounselorAvailability row 생성
function avail(opts: {
  counselorId: string;
  dayOfWeek: number; // 0=일 ~ 6=토 (Date.getUTCDay)
  startHour: number;
  endHour: number;
  recurring?: boolean;
}) {
  return {
    id: `av-${opts.counselorId}-${opts.dayOfWeek}`,
    counselorId: opts.counselorId,
    // 임의 기준일 (2026-01-05 = 월요일). startHour/endHour 만 의미 있음.
    startsAt: new Date(Date.UTC(2026, 0, 5, opts.startHour, 0)),
    endsAt: new Date(Date.UTC(2026, 0, 5, opts.endHour, 0)),
    recurring: opts.recurring ?? true,
    dayOfWeek: opts.dayOfWeek,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("expandRecurringSlots", () => {
  it("recurring=false 는 무시", () => {
    const a = avail({ counselorId: "c", dayOfWeek: 1, startHour: 9, endHour: 12, recurring: false });
    const start = new Date(Date.UTC(2026, 4, 18)); // 월요일
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
    const slots = expandRecurringSlots([a], start, end);
    expect(slots).toEqual([]);
  });

  it("dayOfWeek=1(월) startHour 9 endHour 12 → 다음 7일 안에 월요일 1회, 시간당 3슬롯", () => {
    const a = avail({ counselorId: "c", dayOfWeek: 1, startHour: 9, endHour: 12 });
    const start = new Date(Date.UTC(2026, 4, 18, 0, 0)); // 월요일 00:00
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
    const slots = expandRecurringSlots([a], start, end);
    // 월요일 9, 10, 11 = 3 slots
    expect(slots).toHaveLength(3);
    expect(slots[0].scheduledAt.getUTCHours()).toBe(9);
    expect(slots[2].scheduledAt.getUTCHours()).toBe(11);
    expect(slots.every((s) => s.scheduledAt.getUTCDay() === 1)).toBe(true);
  });

  it("dayOfWeek 매칭되는 요일 외에는 슬롯 없음", () => {
    const a = avail({ counselorId: "c", dayOfWeek: 3, startHour: 9, endHour: 12 });
    const start = new Date(Date.UTC(2026, 4, 18, 0, 0)); // 월요일
    const end = new Date(start.getTime() + 2 * 24 * 60 * 60 * 1000); // 월~화 2일만
    const slots = expandRecurringSlots([a], start, end);
    expect(slots).toEqual([]); // 수요일 없음
  });

  it("excluded scheduledAt 은 결과에서 제거", () => {
    const a = avail({ counselorId: "c", dayOfWeek: 1, startHour: 9, endHour: 12 });
    const start = new Date(Date.UTC(2026, 4, 18, 0, 0));
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
    const blockedAt = new Date(Date.UTC(2026, 4, 18, 10, 0));
    const slots = expandRecurringSlots([a], start, end, new Set([blockedAt.getTime()]));
    expect(slots).toHaveLength(2);
    expect(slots.find((s) => s.scheduledAt.getUTCHours() === 10)).toBeUndefined();
  });

  it("같은 슬롯을 만드는 2개 row 가 있어도 중복 제거", () => {
    const a1 = avail({ counselorId: "c", dayOfWeek: 1, startHour: 9, endHour: 10 });
    const a2 = avail({ counselorId: "c", dayOfWeek: 1, startHour: 9, endHour: 10 });
    const start = new Date(Date.UTC(2026, 4, 18, 0, 0));
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
    const slots = expandRecurringSlots([a1, a2], start, end);
    expect(slots).toHaveLength(1);
  });

  it("결과는 scheduledAt ASC 정렬", () => {
    const a = avail({ counselorId: "c", dayOfWeek: 1, startHour: 9, endHour: 12 });
    const b = avail({ counselorId: "c", dayOfWeek: 2, startHour: 9, endHour: 12 });
    const start = new Date(Date.UTC(2026, 4, 18, 0, 0));
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
    const slots = expandRecurringSlots([b, a], start, end);
    for (let i = 1; i < slots.length; i++) {
      expect(slots[i].scheduledAt.getTime()).toBeGreaterThan(slots[i - 1].scheduledAt.getTime());
    }
  });

  it("windowStart 보다 이전 슬롯은 제외 (윈도 중간 시작 케이스)", () => {
    const a = avail({ counselorId: "c", dayOfWeek: 1, startHour: 9, endHour: 12 });
    // 월요일 10:30 부터 시작, 윈도 6일(다음 월요일 도달 전)
    const start = new Date(Date.UTC(2026, 4, 18, 10, 30));
    const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
    const slots = expandRecurringSlots([a], start, end);
    // 같은 월요일의 11시 슬롯만 (9, 10 은 windowStart 이전, 다음 월요일은 윈도 밖)
    expect(slots).toHaveLength(1);
    expect(slots[0].scheduledAt.getUTCHours()).toBe(11);
  });

  it("윈도 7일 + 중간 시작 → 다음 주 동일 요일의 윈도 내 슬롯은 포함", () => {
    const a = avail({ counselorId: "c", dayOfWeek: 1, startHour: 9, endHour: 12 });
    const start = new Date(Date.UTC(2026, 4, 18, 10, 30));
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
    const slots = expandRecurringSlots([a], start, end);
    // 5/18 11시 + 5/25 9시 + 5/25 10시 (5/25 11시는 windowEnd=5/25 10:30 도달로 제외)
    expect(slots).toHaveLength(3);
  });
});

describe("groupSlotsByDay", () => {
  it("같은 날 슬롯이 같은 그룹", () => {
    const slots = [
      { counselorId: "c", scheduledAt: new Date(Date.UTC(2026, 4, 18, 9, 0)) },
      { counselorId: "c", scheduledAt: new Date(Date.UTC(2026, 4, 18, 10, 0)) },
      { counselorId: "c", scheduledAt: new Date(Date.UTC(2026, 4, 19, 9, 0)) },
    ];
    const groups = groupSlotsByDay(slots);
    expect(groups).toHaveLength(2);
    expect(groups[0].slots).toHaveLength(2);
    expect(groups[1].slots).toHaveLength(1);
  });
});
