"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { RiskBanner, type BannerLevel } from "@/components/risk-banner";
import {
  endSession,
  listSessionMessages,
  sendSessionMessage,
  type SessionMessageView,
} from "@/lib/actions/session";
import type { RiskLevelOut } from "@/lib/ai/risk";

const POLL_INTERVAL_MS = 3_000;

type SessionStatus = "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELED";

export function ChatRoom({
  sessionId,
  myRole,
  peerNickname,
  initialMessages,
  initialStatus,
}: {
  sessionId: string;
  myRole: "EMPLOYEE" | "COUNSELOR";
  peerNickname: string;
  initialMessages: SessionMessageView[];
  initialStatus: SessionStatus;
}) {
  const [messages, setMessages] = useState<SessionMessageView[]>(initialMessages);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [endingPending, startEndTransition] = useTransition();
  const [bannerLevel, setBannerLevel] = useState<BannerLevel | null>(null);
  const [status, setStatus] = useState<SessionStatus>(initialStatus);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastCreatedAtRef = useRef<string | null>(
    initialMessages.length > 0 ? initialMessages[initialMessages.length - 1].createdAtISO : null,
  );

  const isEnded = status === "COMPLETED" || status === "CANCELED";

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
        // 상대편 종료 추정 — SYSTEM 메시지에 "종료" 포함 시 status 갱신 (V1 단순화)
        const endedSys = r.messages.find(
          (m) => m.role === "SYSTEM" && m.content.includes("세션을 종료"),
        );
        if (endedSys) setStatus("COMPLETED");
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

  function handleEnd() {
    if (isEnded || endingPending) return;
    setError(null);
    startEndTransition(async () => {
      const result = await endSession({ sessionId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setStatus("COMPLETED");
    });
  }

  function send() {
    const text = input.trim();
    if (!text || pending) return;
    if (isEnded) {
      setError("이미 종료된 세션입니다.");
      return;
    }
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
      // D19 — L2+ 위기 감지 시 핫라인 배너 활성 (L3/L4 도달 시 downgrade 안 함)
      const next = bannerForLevel(result.riskLevel);
      if (next && bannerLevel !== "L4" && bannerLevel !== "L3") {
        setBannerLevel(next);
      } else if (next === "L4" || next === "L3") {
        setBannerLevel(next);
      }
    });
  }

  function bannerForLevel(level: RiskLevelOut | undefined): BannerLevel | null {
    if (level === "L2" || level === "L3" || level === "L4") return level;
    return null;
  }

  return (
    <div className="space-y-3">
      {bannerLevel && <RiskBanner level={bannerLevel} />}

      {isEnded && myRole === "EMPLOYEE" && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm">
          <p className="text-brand-900">
            세션이 종료됐어요. 잠깐 시간 내서 피드백 남겨 주시면 다음 상담에 큰 도움이 됩니다.
          </p>
          <Button asChild size="sm">
            <Link href={`/app/feedback/${sessionId}`}>피드백 작성</Link>
          </Button>
        </div>
      )}

      {isEnded && myRole === "COUNSELOR" && (
        <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          세션이 종료됐어요. 임상 노트는 케이스 상세 화면에서 작성·확정해 주세요.
        </div>
      )}

      <div className="rounded-lg border border-border bg-background">
        <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-2 text-xs">
          <span className="text-muted-foreground">
            {isEnded ? "세션 종료됨" : "세션 진행 중"}
          </span>
          {!isEnded && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleEnd}
              disabled={endingPending}
            >
              {endingPending ? "종료 중…" : "세션 종료"}
            </Button>
          )}
        </div>
        <div
          ref={scrollRef}
          className="h-[60vh] overflow-y-auto px-4 py-4 space-y-3"
          aria-label="세션 대화"
        >
          {messages.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">메시지가 없습니다.</p>
          ) : (
            messages.map((m) => (
              <Bubble key={m.id} message={m} myRole={myRole} peerNickname={peerNickname} />
            ))
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
          className="border-t border-border p-3"
        >
          <div className="flex items-center gap-1 rounded-full border border-input bg-background pl-4 pr-1.5 py-1.5 transition focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
            <input
              type="text"
              placeholder={isEnded ? "세션 종료됨" : "메시지를 입력하세요"}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={pending || isEnded}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
              autoComplete="off"
              maxLength={2000}
            />
            <Button
              type="submit"
              size="sm"
              disabled={pending || isEnded || !input.trim()}
            >
              보내기
            </Button>
          </div>
        </form>
      </div>
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
