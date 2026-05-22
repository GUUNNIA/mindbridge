"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { acknowledgeRiskFlag, dismissRiskFlag } from "@/lib/actions/risk";

/**
 * 운영자 위기 큐의 row 별 액션 (ack / dismiss).
 *
 * - PENDING 상태에서만 표시
 * - dismiss 는 사유 입력 모달
 */
export function RiskActions({ id, canAck, canDismiss }: {
  id: string;
  canAck: boolean;
  canDismiss: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [showDismiss, setShowDismiss] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleAck() {
    setError(null);
    startTransition(async () => {
      const r = await acknowledgeRiskFlag({ id });
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  }

  function handleDismiss() {
    setError(null);
    startTransition(async () => {
      const r = await dismissRiskFlag({ id, reason });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setShowDismiss(false);
      setReason("");
      router.refresh();
    });
  }

  if (!canAck && !canDismiss) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1">
        {canAck && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={handleAck}
            className="h-7 text-xs"
          >
            확인 (ACK)
          </Button>
        )}
        {canDismiss && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => setShowDismiss((v) => !v)}
            className="h-7 text-xs"
          >
            디스미스
          </Button>
        )}
      </div>
      {showDismiss && (
        <div className="rounded-md border border-border bg-muted/40 p-2 text-xs space-y-1">
          <label className="block text-muted-foreground">
            사유 (5자 이상):
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 w-full rounded border border-border bg-background p-1 text-xs"
              rows={2}
              placeholder="false positive — 키워드 매칭이지만 맥락은 무해"
            />
          </label>
          <div className="flex gap-1">
            <Button
              type="button"
              size="sm"
              disabled={pending || reason.trim().length < 5}
              onClick={handleDismiss}
              className="h-7 text-xs"
            >
              확정
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                setShowDismiss(false);
                setReason("");
                setError(null);
              }}
              className="h-7 text-xs"
            >
              취소
            </Button>
          </div>
        </div>
      )}
      {error && <span className="text-xs text-red-700">{error}</span>}
    </div>
  );
}
