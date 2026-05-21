/**
 * MessagingProvider 추상화 (Day 15).
 *
 * V1 은 Mock-only — publishMessage 는 noop, client 는 3초 폴링으로 새 메시지 fetch.
 * 시연용 충분 (두 계정이 같은 방에서 메시지 교환). 진짜 real-time 은 V2 Pusher.
 *
 * Pusher 도입 시 PUSHER_APP_ID 등 환경변수로 자동 전환 — D9/D12 패턴과 동일.
 */

export interface PublishInput {
  channel: string; // 예: "session-<sessionId>"
  event: string; // 예: "new-message"
  payload: unknown;
}

export interface MessagingProvider {
  publishMessage(input: PublishInput): Promise<void>;
}

class MockMessagingProvider implements MessagingProvider {
  async publishMessage(_input: PublishInput): Promise<void> {
    // noop — client polling 으로 fetch
  }
}

class PusherMessagingProvider implements MessagingProvider {
  async publishMessage(input: PublishInput): Promise<void> {
    // V2: import("pusher") + trigger
    // dev plan §4 D15 fallback 으로 mock 유지 결정 (2026-05-21)
    throw new Error(
      `[messaging] Pusher provider not yet implemented (channel=${input.channel}). Mock-only 모드.`,
    );
  }
}

export const isPusherEnabled = !!process.env.PUSHER_APP_ID;
export const messagingKind: "pusher" | "mock" = isPusherEnabled ? "pusher" : "mock";

export const messagingProvider: MessagingProvider = isPusherEnabled
  ? new PusherMessagingProvider()
  : new MockMessagingProvider();
