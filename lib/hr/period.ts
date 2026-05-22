/**
 * HR 대시보드 기간 헬퍼 (server action 파일과 분리).
 *
 * "use server" 파일은 async export 만 허용되므로 동기 헬퍼는 여기에 둔다.
 */

import type { DashboardPeriodInput } from "@/lib/actions/hr";

/** 이번 달 기간 (UTC 기준 월 시작 ~ 다음 달 시작). */
export function thisMonthUtc(now: Date = new Date()): DashboardPeriodInput {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
  );
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0),
  );
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

/** N개월 전부터 이번 달 끝까지 (시계열 차트 D23 에서 사용). */
export function lastNMonthsUtc(n: number, now: Date = new Date()): DashboardPeriodInput {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (n - 1), 1, 0, 0, 0, 0),
  );
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0),
  );
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}
