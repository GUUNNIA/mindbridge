import { describe, it, expect } from "vitest";

import { renderTemplate } from "@/lib/notifications/templates";

/**
 * outbox.test.ts — Day 12.
 *
 * 실 DB 가 필요한 enqueue/processOutbox 동작은 W2 D14 E2E 또는 별도 통합 테스트에서.
 * 여기서는 순수 함수(템플릿 렌더링)만 검증 — Vitest 가 DB 없이 빠르게 통과.
 */

describe("renderTemplate — 4 종 NotificationType", () => {
  const payload = {
    counselorName: "상담사-A",
    scheduledAtKST: "2026년 5월 22일 금 17:00",
    bookingId: "test-booking-id",
  };

  it("BOOKING_REQUESTED — subject 와 본문에 상담사·일시 포함", () => {
    const r = renderTemplate("BOOKING_REQUESTED", payload);
    expect(r.subject).toContain("예약 요청 접수");
    expect(r.subject).toContain("상담사-A");
    expect(r.subject).toContain("2026년 5월 22일 금 17:00");
    expect(r.text).toContain("상담사-A");
    expect(r.text).toContain("2026년 5월 22일 금 17:00");
    expect(r.html).toContain("예약 요청 접수");
  });

  it("BOOKING_CONFIRMED — subject 가 '예약 확정'", () => {
    const r = renderTemplate("BOOKING_CONFIRMED", payload);
    expect(r.subject).toContain("예약 확정");
    expect(r.text).toContain("예약이 확정");
  });

  it("BOOKING_CANCELED — subject 가 '예약 취소'", () => {
    const r = renderTemplate("BOOKING_CANCELED", payload);
    expect(r.subject).toContain("예약 취소");
    expect(r.text).toContain("예약이 취소");
  });

  it("BOOKING_REMINDER — subject 가 '내일 상담 예정'", () => {
    const r = renderTemplate("BOOKING_REMINDER", payload);
    expect(r.subject).toContain("내일 상담 예정");
  });

  it("HTML 본문은 특수문자 escape (XSS 방지)", () => {
    const r = renderTemplate("BOOKING_REQUESTED", {
      ...payload,
      counselorName: '<script>alert("x")</script>',
    });
    expect(r.html).not.toContain("<script>");
    expect(r.html).toContain("&lt;script&gt;");
  });
});
