"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { createInviteCode } from "@/lib/actions/invites";

export function IssueInviteForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [expiresInDays, setExpiresInDays] = useState<number>(30);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lastCode, setLastCode] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLastCode(null);
    startTransition(async () => {
      const result = await createInviteCode({
        email: email.trim() || undefined,
        expiresInDays,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setLastCode(result.code);
      setEmail("");
      router.refresh();
    });
  }

  async function copyCode() {
    if (!lastCode) return;
    try {
      await navigator.clipboard.writeText(lastCode);
    } catch {
      // 무시 — fallback 없이 표시만
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid gap-3 md:grid-cols-[2fr_1fr_auto] md:items-end">
        <div className="space-y-1.5">
          <label htmlFor="invite-email" className="text-sm font-medium">
            대상 이메일 (선택)
          </label>
          <input
            id="invite-email"
            type="email"
            placeholder="employee@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={pending}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="invite-expires" className="text-sm font-medium">
            유효 기간 (일)
          </label>
          <input
            id="invite-expires"
            type="number"
            min={1}
            max={90}
            value={expiresInDays}
            onChange={(e) => setExpiresInDays(Number(e.target.value) || 30)}
            disabled={pending}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
          />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "발급 중…" : "코드 발급"}
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {lastCode && (
        <div className="rounded-md border border-brand-200 bg-brand-50 p-3 text-sm">
          <p className="font-medium text-brand-700">발급 완료</p>
          <div className="mt-1 flex items-center gap-2">
            <code className="rounded bg-background px-2 py-1 font-mono text-brand-700">
              {lastCode}
            </code>
            <Button type="button" size="sm" variant="outline" onClick={copyCode}>
              복사
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            가입 URL: <code>/signup?code={lastCode}</code> 로 직원에게 공유 가능
          </p>
        </div>
      )}
    </form>
  );
}
