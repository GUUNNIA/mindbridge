import { describe, it, expect, beforeEach, afterEach } from "vitest";

import {
  computeSlaDueAt,
  getSlaHours,
  getSlaMinutesOverride,
} from "@/lib/escalation/sla";
import { renderTemplate } from "@/lib/notifications/templates";

/**
 * escalation.test.ts — D20.
 *
 * DB 의존 (server actions, sla-cron) 검증은 W3 회귀 E2E 와 별도 통합 테스트에서.
 * 여기서는 순수 함수 — SLA helper + 알림 템플릿 + risk 모듈 자동 escalation 분기 —
 * 만 검증 (outbox.test.ts 패턴과 동일).
 */

describe("getSlaHours — ESCALATION_SLA_HOURS env 기반", () => {
  const orig = process.env.ESCALATION_SLA_HOURS;
  afterEach(() => {
    if (orig === undefined) delete process.env.ESCALATION_SLA_HOURS;
    else process.env.ESCALATION_SLA_HOURS = orig;
  });

  it("env 미설정 시 default 24", () => {
    delete process.env.ESCALATION_SLA_HOURS;
    expect(getSlaHours()).toBe(24);
  });

  it("양수 정수 시 그 값 사용", () => {
    process.env.ESCALATION_SLA_HOURS = "1";
    expect(getSlaHours()).toBe(1);
  });

  it("0·음수·문자열 시 24 fallback", () => {
    process.env.ESCALATION_SLA_HOURS = "0";
    expect(getSlaHours()).toBe(24);
    process.env.ESCALATION_SLA_HOURS = "-5";
    expect(getSlaHours()).toBe(24);
    process.env.ESCALATION_SLA_HOURS = "abc";
    expect(getSlaHours()).toBe(24);
  });
});

describe("getSlaMinutesOverride — 시연·테스트용 분 단위 단축", () => {
  const orig = process.env.ESCALATION_SLA_MINUTES_OVERRIDE;
  afterEach(() => {
    if (orig === undefined) delete process.env.ESCALATION_SLA_MINUTES_OVERRIDE;
    else process.env.ESCALATION_SLA_MINUTES_OVERRIDE = orig;
  });

  it("미설정 시 null", () => {
    delete process.env.ESCALATION_SLA_MINUTES_OVERRIDE;
    expect(getSlaMinutesOverride()).toBeNull();
  });

  it("양수 정수 시 그 값", () => {
    process.env.ESCALATION_SLA_MINUTES_OVERRIDE = "5";
    expect(getSlaMinutesOverride()).toBe(5);
  });

  it("잘못된 값 시 null", () => {
    process.env.ESCALATION_SLA_MINUTES_OVERRIDE = "x";
    expect(getSlaMinutesOverride()).toBeNull();
  });
});

describe("computeSlaDueAt — env 기반 마감 시각 계산", () => {
  const origHours = process.env.ESCALATION_SLA_HOURS;
  const origMin = process.env.ESCALATION_SLA_MINUTES_OVERRIDE;

  beforeEach(() => {
    delete process.env.ESCALATION_SLA_HOURS;
    delete process.env.ESCALATION_SLA_MINUTES_OVERRIDE;
  });
  afterEach(() => {
    if (origHours === undefined) delete process.env.ESCALATION_SLA_HOURS;
    else process.env.ESCALATION_SLA_HOURS = origHours;
    if (origMin === undefined) delete process.env.ESCALATION_SLA_MINUTES_OVERRIDE;
    else process.env.ESCALATION_SLA_MINUTES_OVERRIDE = origMin;
  });

  it("default 24h → 24*60*60*1000 ms 가산", () => {
    const from = new Date("2026-05-21T00:00:00Z");
    const due = computeSlaDueAt(from);
    expect(due.getTime() - from.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it("ESCALATION_SLA_HOURS=1 → 1h 가산", () => {
    process.env.ESCALATION_SLA_HOURS = "1";
    const from = new Date("2026-05-21T00:00:00Z");
    const due = computeSlaDueAt(from);
    expect(due.getTime() - from.getTime()).toBe(60 * 60 * 1000);
  });

  it("ESCALATION_SLA_MINUTES_OVERRIDE 가 ESCALATION_SLA_HOURS 보다 우선", () => {
    process.env.ESCALATION_SLA_HOURS = "24";
    process.env.ESCALATION_SLA_MINUTES_OVERRIDE = "10";
    const from = new Date("2026-05-21T00:00:00Z");
    const due = computeSlaDueAt(from);
    expect(due.getTime() - from.getTime()).toBe(10 * 60 * 1000);
  });
});

describe("renderTemplate ESCALATION_EXPIRED — 운영자 알림", () => {
  it("subject·본문에 익명 ID·SLA 만료 시각 포함", () => {
    const r = renderTemplate("ESCALATION_EXPIRED", {
      escalationId: "esc-1",
      subjectAnonymizedId: "anon-abc12345",
      riskSummary: "구체적 자해 계획 언급",
      slaDueAtKST: "2026년 5월 21일 금 09:00",
    });
    expect(r.subject).toContain("SLA 만료");
    expect(r.subject).toContain("anon-abc12345");
    expect(r.text).toContain("anon-abc12345");
    expect(r.text).toContain("2026년 5월 21일 금 09:00");
    expect(r.text).toContain("esc-1");
    expect(r.html).toContain("위기 에스컬레이션 SLA 만료");
  });

  it("riskSummary 가 null 이어도 렌더 OK (요약 줄 생략)", () => {
    const r = renderTemplate("ESCALATION_EXPIRED", {
      escalationId: "esc-2",
      subjectAnonymizedId: "anon-x",
      riskSummary: null,
      slaDueAtKST: "2026년 5월 21일 금 09:00",
    });
    expect(r.text).not.toContain("요약:");
    expect(r.html).not.toMatch(/요약<\/td>/);
  });

  it("HTML 본문은 익명 ID·요약 escape (XSS 방지)", () => {
    const r = renderTemplate("ESCALATION_EXPIRED", {
      escalationId: "esc-3",
      subjectAnonymizedId: '<script>alert("x")</script>',
      riskSummary: "<b>danger</b>",
      slaDueAtKST: "2026년 5월 21일 금 09:00",
    });
    expect(r.html).not.toContain("<script>");
    expect(r.html).not.toContain("<b>danger");
    expect(r.html).toContain("&lt;script&gt;");
  });
});
