/**
 * NotificationProvider 추상화 (Day 12).
 *
 * RESEND_API_KEY 가 환경변수에 있으면 ResendProvider,
 * 없으면 MockProvider (console.log 만 — 실 발송 0).
 *
 * 인터페이스는 동일하므로 키만 채우면 자동 전환. Day 9 classifyCategory 패턴과 동일.
 */

export interface SendInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface SendResult {
  ok: boolean;
  providerMessageId?: string;
  error?: string;
}

export interface NotificationProvider {
  send(input: SendInput): Promise<SendResult>;
}

export const isResendEnabled = !!process.env.RESEND_API_KEY;

const FROM_ADDRESS = process.env.RESEND_FROM ?? "onboarding@resend.dev";

class MockProvider implements NotificationProvider {
  async send(input: SendInput): Promise<SendResult> {
    // eslint-disable-next-line no-console
    console.log(
      `[notification:mock] to=${input.to} subject="${input.subject}" (RESEND_API_KEY 미설정 — 실 발송 없음)`,
    );
    return { ok: true, providerMessageId: `mock-${Date.now()}` };
  }
}

class ResendProvider implements NotificationProvider {
  async send(input: SendInput): Promise<SendResult> {
    const { Resend } = await import("resend");
    const client = new Resend(process.env.RESEND_API_KEY);
    try {
      const r = await client.emails.send({
        from: FROM_ADDRESS,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
      });
      if (r.error) {
        return { ok: false, error: r.error.message ?? String(r.error) };
      }
      return { ok: true, providerMessageId: r.data?.id };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
}

export const provider: NotificationProvider = isResendEnabled
  ? new ResendProvider()
  : new MockProvider();

export const providerKind: "resend" | "mock" = isResendEnabled ? "resend" : "mock";
