"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RiskBanner, type BannerLevel } from "@/components/risk-banner";
import { sendAssessmentMessage } from "@/lib/actions/assessment";
import type { RiskLevelOut } from "@/lib/ai/risk";

type Message = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
};

const INTRO_MESSAGE: Message = {
  id: "intro",
  role: "ASSISTANT",
  content:
    "안녕하세요. 자가진단을 시작합니다. 편하게 적어 주세요 — 어떤 점이 가장 힘드신가요?",
};

export function AssessmentChat({
  assessmentId,
  initialMessages,
}: {
  assessmentId: string;
  initialMessages: Message[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(
    initialMessages.length === 0 ? [INTRO_MESSAGE] : initialMessages,
  );
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [bannerLevel, setBannerLevel] = useState<BannerLevel | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function send() {
    const text = input.trim();
    if (!text || pending) return;
    setError(null);
    setInput("");

    const optimisticUser: Message = {
      id: `tmp-u-${Date.now()}`,
      role: "USER",
      content: text,
    };
    setMessages((prev) => [...prev, optimisticUser]);

    startTransition(async () => {
      try {
        const result = await sendAssessmentMessage({ assessmentId, text });
        const assistantMsg: Message = {
          id: `tmp-a-${Date.now()}`,
          role: "ASSISTANT",
          content: result.reply,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        // D19 — L2+ 위기 감지 시 핫라인 배너 노출 (한 번 켜지면 끝까지 유지)
        const newBanner = bannerForLevel(result.riskLevel);
        if (newBanner && bannerLevel !== "L4" && bannerLevel !== "L3") {
          setBannerLevel(newBanner);
        }
        if (result.completed) {
          router.push(`/app/assessment/${assessmentId}/result`);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
      }
    });
  }

  function bannerForLevel(level: RiskLevelOut | undefined): BannerLevel | null {
    if (level === "L2" || level === "L3" || level === "L4") return level;
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-3">
      {bannerLevel && <RiskBanner level={bannerLevel} />}
      <Card>
      <CardHeader>
        <CardTitle className="text-2xl text-brand-700">자가진단</CardTitle>
        <CardDescription>4~6턴 대화 후 카테고리·심각도를 안내드립니다.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          ref={scrollRef}
          className="h-[400px] overflow-y-auto rounded-md border border-border bg-muted/30 p-4 space-y-3"
        >
          {messages.map((m) => (
            <Bubble key={m.id} role={m.role} content={m.content} />
          ))}
          {pending && <Bubble role="ASSISTANT" content="응답을 생성하는 중…" muted />}
        </div>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            placeholder="여기에 메시지를 입력하세요"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={pending}
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
            autoComplete="off"
          />
          <Button type="submit" disabled={pending || !input.trim()}>
            보내기
          </Button>
        </form>
      </CardContent>
      </Card>
    </div>
  );
}

function Bubble({
  role,
  content,
  muted,
}: {
  role: "USER" | "ASSISTANT";
  content: string;
  muted?: boolean;
}) {
  const isUser = role === "USER";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={[
          "max-w-[80%] rounded-lg px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap",
          isUser
            ? "bg-primary text-primary-foreground"
            : muted
              ? "bg-background text-muted-foreground italic"
              : "bg-background text-foreground border border-border",
        ].join(" ")}
      >
        {content}
      </div>
    </div>
  );
}
