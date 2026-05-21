/**
 * Escalation SLA 헬퍼 (D20).
 *
 * BR-6: 24h. dev/test 환경에서 24h 기다릴 수 없어 `ESCALATION_SLA_HOURS` env 로 override.
 * 양수 정수만 인정, 그 외(미설정·문자열·0·음수)는 24 fallback. 짧은 분 단위가 필요하면
 * 별도 env 추가 대신 ESCALATION_SLA_MINUTES_OVERRIDE 를 시연 모드에서만 우선시.
 */

export function getSlaHours(): number {
  const raw = process.env.ESCALATION_SLA_HOURS;
  if (!raw) return 24;
  const n = Number.parseInt(raw, 10);
  if (Number.isFinite(n) && n > 0) return n;
  return 24;
}

/** 시연·테스트 전용 분 단위 override. SLA cron 과 createDueDate 양쪽이 동일하게 참조. */
export function getSlaMinutesOverride(): number | null {
  const raw = process.env.ESCALATION_SLA_MINUTES_OVERRIDE;
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  if (Number.isFinite(n) && n > 0) return n;
  return null;
}

export function computeSlaDueAt(from: Date = new Date()): Date {
  const minutes = getSlaMinutesOverride();
  if (minutes !== null) {
    return new Date(from.getTime() + minutes * 60 * 1000);
  }
  return new Date(from.getTime() + getSlaHours() * 60 * 60 * 1000);
}
