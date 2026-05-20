import type { CounselorAvailability } from "@prisma/client";

/**
 * CounselorAvailability(주간 반복 블록)를 구체 시각 슬롯으로 펼침.
 *
 * V1 정책:
 *   - recurring=true 만 고려 (단발 슬롯은 V2)
 *   - dayOfWeek 매칭 + (startsAt 시각 시 분) 부터 (endsAt - 1h) 까지 1시간 단위
 *   - 윈도 [windowStart, windowEnd) 안에 들어오는 슬롯만 반환
 *   - excludedSlots(이미 예약된 scheduledAt 집합) 는 결과에서 제외
 *
 * 시간 기준: schema 상 UTC (Group A 결정: DB UTC + UI KST). UI 에서 KST 표시.
 */

export interface Slot {
  counselorId: string;
  scheduledAt: Date;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export function expandRecurringSlots(
  availability: CounselorAvailability[],
  windowStart: Date,
  windowEnd: Date,
  excludedScheduledAt: Set<number> = new Set(),
): Slot[] {
  const slots: Slot[] = [];

  for (const a of availability) {
    if (!a.recurring || a.dayOfWeek == null) continue;
    if (a.endsAt.getTime() <= a.startsAt.getTime()) continue;

    const startHour = a.startsAt.getUTCHours();
    const startMin = a.startsAt.getUTCMinutes();
    const durationHours = Math.floor((a.endsAt.getTime() - a.startsAt.getTime()) / HOUR_MS);

    // 윈도 시작일의 자정(UTC)부터 7번 반복하면서 dayOfWeek 매칭 시 슬롯 생성
    const baseDay = new Date(
      Date.UTC(
        windowStart.getUTCFullYear(),
        windowStart.getUTCMonth(),
        windowStart.getUTCDate(),
      ),
    );

    for (let d = 0; d < 8; d++) {
      const candidate = new Date(baseDay.getTime() + d * DAY_MS);
      if (candidate.getUTCDay() !== a.dayOfWeek) continue;

      for (let h = 0; h < durationHours; h++) {
        const slot = new Date(
          Date.UTC(
            candidate.getUTCFullYear(),
            candidate.getUTCMonth(),
            candidate.getUTCDate(),
            startHour + h,
            startMin,
            0,
            0,
          ),
        );
        if (slot.getTime() < windowStart.getTime()) continue;
        if (slot.getTime() >= windowEnd.getTime()) continue;
        if (excludedScheduledAt.has(slot.getTime())) continue;
        slots.push({ counselorId: a.counselorId, scheduledAt: slot });
      }
    }
  }

  // 정렬 + 중복 제거 (서로 다른 availability row 가 같은 슬롯 만들 수 있음)
  const seen = new Set<number>();
  return slots
    .filter((s) => {
      const k = s.scheduledAt.getTime();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
}

/** 슬롯을 날짜별로 그룹화 — UI 표시용 */
export function groupSlotsByDay(slots: Slot[]): Array<{ dayKey: string; slots: Slot[] }> {
  const groups = new Map<string, Slot[]>();
  for (const s of slots) {
    const d = s.scheduledAt;
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    const list = groups.get(key) ?? [];
    list.push(s);
    groups.set(key, list);
  }
  return [...groups.entries()].map(([dayKey, slots]) => ({ dayKey, slots }));
}
