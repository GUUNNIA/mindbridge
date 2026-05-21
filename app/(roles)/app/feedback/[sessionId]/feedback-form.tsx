"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { submitFeedback } from "@/lib/actions/feedback";

/**
 * 피드백 폼 (D21, UC-5).
 * - 평점 1~5 별 (필수)
 * - 코멘트 (선택, 최대 2000자)
 * - 같은 상담사 재예약 의사 (boolean)
 */
export function FeedbackForm({
  sessionId,
  counselorNickname,
}: {
  sessionId: string;
  counselorNickname: string;
}) {
  const router = useRouter();
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState<string>("");
  const [wantSameCounselor, setWantSameCounselor] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canSubmit = rating >= 1 && rating <= 5 && !pending;

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit) {
          setError("평점을 선택해 주세요.");
          return;
        }
        setError(null);
        startTransition(async () => {
          const r = await submitFeedback({
            sessionId,
            rating,
            comment: comment.trim() || undefined,
            wantSameCounselor,
          });
          if (!r.ok) {
            setError(r.error);
            return;
          }
          router.push("/app?feedback=submitted");
          router.refresh();
        });
      }}
    >
      <fieldset>
        <legend className="mb-2 block text-sm font-medium text-foreground">
          {counselorNickname} 상담사와의 세션은 어땠나요?{" "}
          <span className="text-red-700">*</span>
        </legend>
        <div className="flex items-center gap-2" role="radiogroup" aria-label="평점">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`별 ${n}개`}
              onClick={() => setRating(n)}
              className={`h-10 w-10 rounded-md border text-2xl leading-none transition ${
                rating >= n
                  ? "border-amber-300 bg-amber-50 text-amber-500"
                  : "border-input bg-background text-muted-foreground hover:bg-muted/40"
              }`}
            >
              ★
            </button>
          ))}
          <span className="ml-2 text-xs text-muted-foreground">
            {rating === 0 ? "선택 안 함" : `${rating}점`}
          </span>
        </div>
      </fieldset>

      <div>
        <label
          htmlFor="comment"
          className="mb-1 block text-sm font-medium text-foreground"
        >
          코멘트 <span className="text-muted-foreground">(선택)</span>
        </label>
        <textarea
          id="comment"
          rows={5}
          maxLength={2000}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="세션에서 도움 되었던 점, 아쉬웠던 점을 적어 주세요."
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          상담사 본인에게는 코멘트가 노출되지 않으며, 운영자 품질 모니터링에 사용됩니다.
        </p>
      </div>

      <div className="flex items-start gap-2">
        <input
          id="want-same"
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-input"
          checked={wantSameCounselor}
          onChange={(e) => setWantSameCounselor(e.target.checked)}
        />
        <label htmlFor="want-same" className="text-sm">
          다음에도 {counselorNickname} 상담사와 다시 만나고 싶어요.
        </label>
      </div>

      {error && (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={!canSubmit}>
          {pending ? "제출 중…" : "피드백 제출"}
        </Button>
        <Button asChild type="button" variant="outline">
          <a href="/app">나중에 작성</a>
        </Button>
      </div>
    </form>
  );
}
