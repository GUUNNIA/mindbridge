import type { NotificationType } from "@prisma/client";

/**
 * 이메일 템플릿 (Day 12).
 *
 * V1 한국어 하드코딩 (Group A 결정). i18n 은 V2.
 * payload 는 NotificationOutbox.payload 에 그대로 저장되므로
 * 템플릿 수정 시점에도 과거 row 가 동일 렌더링되도록 단순 변수만 사용.
 */

export interface BookingPayload {
  counselorName: string;
  scheduledAtKST: string; // pre-formatted, 예: "2026년 5월 22일 금 17:00"
  bookingId: string;
}

export interface EscalationExpiredPayload {
  escalationId: string;
  subjectAnonymizedId: string; // 운영자 화면 익명 표시
  riskSummary: string | null;
  slaDueAtKST: string; // pre-formatted
}

export type TemplatePayload = BookingPayload | EscalationExpiredPayload;

export interface Rendered {
  subject: string;
  html: string;
  text: string;
}

function renderBookingRequested(p: BookingPayload): Rendered {
  const subject = `[MindBridge] 예약 요청 접수 — ${p.counselorName} ${p.scheduledAtKST}`;
  const text =
    `예약 요청이 접수됐습니다.\n\n` +
    `상담사: ${p.counselorName}\n` +
    `일시(KST): ${p.scheduledAtKST}\n\n` +
    `상담사가 수락하면 별도 확정 메일이 발송됩니다.\n` +
    `— MindBridge`;
  const html =
    `<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.6;color:#1f2937;">` +
    `<h2 style="color:#0f766e;margin:0 0 12px;">예약 요청 접수</h2>` +
    `<p>예약 요청이 접수됐습니다.</p>` +
    `<table style="border-collapse:collapse;margin:12px 0;">` +
    `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;">상담사</td><td style="padding:4px 0;">${escapeHtml(p.counselorName)}</td></tr>` +
    `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;">일시 (KST)</td><td style="padding:4px 0;">${escapeHtml(p.scheduledAtKST)}</td></tr>` +
    `</table>` +
    `<p style="color:#6b7280;font-size:12px;">상담사가 수락하면 별도 확정 메일이 발송됩니다.</p>` +
    `<p style="color:#6b7280;font-size:12px;">— MindBridge</p>` +
    `</div>`;
  return { subject, html, text };
}

function renderBookingConfirmed(p: BookingPayload): Rendered {
  const subject = `[MindBridge] 예약 확정 — ${p.counselorName} ${p.scheduledAtKST}`;
  const text =
    `예약이 확정됐습니다.\n\n` +
    `상담사: ${p.counselorName}\n` +
    `일시(KST): ${p.scheduledAtKST}\n\n` +
    `세션 시작 시각 직전에 입장 안내를 다시 보내드립니다.\n— MindBridge`;
  const html = renderBookingRequested(p).html.replace("예약 요청 접수", "예약 확정");
  return { subject, html, text };
}

function renderBookingCanceled(p: BookingPayload): Rendered {
  const subject = `[MindBridge] 예약 취소 — ${p.counselorName} ${p.scheduledAtKST}`;
  const text =
    `예약이 취소됐습니다.\n\n` +
    `상담사: ${p.counselorName}\n` +
    `일시(KST): ${p.scheduledAtKST}\n— MindBridge`;
  const html = renderBookingRequested(p).html.replace("예약 요청 접수", "예약 취소");
  return { subject, html, text };
}

function renderBookingReminder(p: BookingPayload): Rendered {
  const subject = `[MindBridge] 내일 상담 예정 — ${p.counselorName} ${p.scheduledAtKST}`;
  const text =
    `내일 상담 일정이 있습니다.\n\n` +
    `상담사: ${p.counselorName}\n` +
    `일시(KST): ${p.scheduledAtKST}\n— MindBridge`;
  const html = renderBookingRequested(p).html.replace("예약 요청 접수", "내일 상담 예정");
  return { subject, html, text };
}

function renderEscalationExpired(p: EscalationExpiredPayload): Rendered {
  const subject = `[MindBridge] 위기 에스컬레이션 SLA 만료 — ${p.subjectAnonymizedId}`;
  const text =
    `위기 에스컬레이션 SLA 가 만료됐습니다. 운영자 즉시 확인 필요.\n\n` +
    `대상(익명 ID): ${p.subjectAnonymizedId}\n` +
    `SLA 만료(KST): ${p.slaDueAtKST}\n` +
    (p.riskSummary ? `요약: ${p.riskSummary}\n` : "") +
    `\n에스컬레이션 ID: ${p.escalationId}\n— MindBridge`;
  const html =
    `<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.6;color:#1f2937;">` +
    `<h2 style="color:#b91c1c;margin:0 0 12px;">위기 에스컬레이션 SLA 만료</h2>` +
    `<p>전문의 사인오프가 SLA 내 미완료. 운영자 즉시 확인 필요.</p>` +
    `<table style="border-collapse:collapse;margin:12px 0;">` +
    `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;">대상</td><td style="padding:4px 0;">${escapeHtml(p.subjectAnonymizedId)}</td></tr>` +
    `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;">SLA 만료 (KST)</td><td style="padding:4px 0;">${escapeHtml(p.slaDueAtKST)}</td></tr>` +
    (p.riskSummary
      ? `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;">요약</td><td style="padding:4px 0;">${escapeHtml(p.riskSummary)}</td></tr>`
      : "") +
    `</table>` +
    `<p style="color:#6b7280;font-size:12px;">에스컬레이션 ID: ${escapeHtml(p.escalationId)}</p>` +
    `<p style="color:#6b7280;font-size:12px;">— MindBridge</p>` +
    `</div>`;
  return { subject, html, text };
}

export function renderTemplate(type: NotificationType, payload: TemplatePayload): Rendered {
  switch (type) {
    case "BOOKING_REQUESTED":
      return renderBookingRequested(payload as BookingPayload);
    case "BOOKING_CONFIRMED":
      return renderBookingConfirmed(payload as BookingPayload);
    case "BOOKING_CANCELED":
      return renderBookingCanceled(payload as BookingPayload);
    case "BOOKING_REMINDER":
      return renderBookingReminder(payload as BookingPayload);
    case "ESCALATION_EXPIRED":
      return renderEscalationExpired(payload as EscalationExpiredPayload);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
