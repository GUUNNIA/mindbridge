"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  listSessionMessages,
  sendSessionMessage,
  type SessionMessageView,
} from "@/lib/actions/session";

const POLL_INTERVAL_MS = 3_000;

export function ChatRoom({
  sessionId,
  myRole,
  peerNickname,
  initialMessages,
}: {
  sessionId: string;
  myRole: "EMPLOYEE" | "COUNSELOR";
  peerNickname: string;
  initialMessages: SessionMessageView[];
}) {
  const [messages, setMessages] = useState<SessionMessageView[]>(initialMessages);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastCreatedAtRef = useRef<string | null>(
    initialMessages.length > 0 ? initialMessages[initialMessages.length - 1].createdAtISO : null,
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await listSessionMessages({
          sessionId,
          sinceISO: lastCreatedAtRef.current ?? undefined,
        });
        if (cancelled || !r.ok || r.messages.length === 0) return;
        lastCreatedAtRef.current = r.messages[r.messages.length - 1].createdAtISO;
        setMessages((prev) => mergeUnique(prev, r.messages));
      } catch {
        // 폴링 일시 실패는 무시 — 다음 tick 에서 재시도
      }
    };
    const id = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [sessionId]);

  function send() {
    const text = input.trim();
    if (!text || pending) return;
    setError(null);

    startTransition(async () => {
      const result = await sendSessionMessage({ sessionId, content: text });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setInput("");
      // 즉시 본인 메시지를 화면에 표시 (낙관적). 폴링이 곧 정식 row 도 가져옴 (dedupe).
      const optimistic: SessionMessageView = {
        id: result.messageId,
        role: myRole,
        content: text,
        senderId: "me",
        createdAtISO: new Date().toISOString(),
      };
      setMessages((prev) => mergeUnique(prev, [optimistic]));
      lastCreatedAtRef.current = optimistic.createdAtISO;
    });
  }

  return (
    <div className="rounded-lg border border-border bg-background">
      <div
        ref={scrollRef}
        className="h-[60vh] overflow-y-auto px-4 py-4 space-y-3"
        aria-label="세션 대화"
      >
        {messages.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">메시지가 없습니다.</p>
        ) : (
          messages.map((m) => <Bubble key={m.id} message={m} myRole={myRole} peerNickname={peerNickname} />)
        )}
        {pending && <p className="text-xs text-muted-foreground">전송 중…</p>}
      </div>

      {error && (
        <p className="px-4 pt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex gap-2 border-t border-border p-3"
      >
        <input
          type="text"
          placeholder="메시지를 입력하세요"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={pending}
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
          autoComplete="off"
          maxLength={2000}
        />
        <Button type="submit" disabled={pending || !input.trim()}>
          보내기
        </Button>
      </form>
    </div>
  );
}

function Bubble({
  message,
  myRole,
  peerNickname,
}: {
  message: SessionMessageView;
  myRole: "EMPLOYEE" | "COUNSELOR";
  peerNickname: string;
}) {
  if (message.role === "SYSTEM") {
    return (
      <div className="text-center text-xs text-muted-foreground italic">{message.content}</div>
    );
  }
  const isMine = message.role === myRole;
  const label = isMine ? "나" : peerNickname;
  return (
    <div className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <div
        className={[
          "max-w-[80%] rounded-lg px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap",
          isMine
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground border border-border",
        ].join(" ")}
      >
        {message.content}
      </div>
    </div>
  );
}

function mergeUnique(
  prev: SessionMessageView[],
  next: SessionMessageView[],
): SessionMessageView[] {
  const seen = new Set(prev.map((m) => m.id));
  const merged = [...prev];
  for (const m of next) {
    if (!seen.has(m.id)) {
      merged.push(m);
      seen.add(m.id);
    }
  }
  return merged;
}
