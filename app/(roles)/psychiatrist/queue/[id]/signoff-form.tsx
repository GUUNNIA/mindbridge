"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { signOffEscalation, reviewEscalation } from "@/lib/actions/escalation";

/**
 * 사인오프 폼 (D20, PRD US-P1 AC2).
 * - decision: 자유 텍스트 (셀렉트 + 직접 입력 옵션)
 * - decisionNote: 의견 입력 필수 (5자 이상)
 * - familyConsent: 가족 동의 체크박스
 *
 * 같은 컴포넌트가 PENDING 상태일 땐 "검토 시작" 버튼만 보여서 reviewEscalation 호출.
 */

const DECISION_OPTIONS = [
  { value: "follow_up_2w", label: "2주 내 후속 세션 권고" },
  { value: "medication_consult", label: "약물 상담 의뢰" },
  { value: "external_referral", label: "외부 전문 기관 의뢰" },
  { value: "no_immediate_action", label: "긴급 조치 불필요 (모니터링)" },
];

type Status = "PENDING" | "IN_REVIEW" | "DECIDED" | "EXPIRED";

export function SignOffForm({
  escalationId,
  status,
  isMine,
}: {
  escalationId: string;
  status: Status;
  isMine: boolean;
}) {
  const router = useRouter();
  const [decision, setDecision] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [familyConsent, setFamilyConsent] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (status === "DECIDED") {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        사인오프 완료된 케이스입니다.
      </div>
    );
  }

  if (status === "EXPIRED") {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900">
        SLA 만료된 케이스입니다. 운영자가 후속 조치를 진행합니다.
      </div>
    );
  }

  if (status === "PENDING") {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm">
        <p className="mb-3 text-amber-900">
          이 케이스는 아직 검토자가 배정되지 않았습니다. 검토를 시작하면 본인이 잠금하고
          다른 전문의에게는 큐에 보이지 않습니다.
        </p>
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const r = await reviewEscalation({ id: escalationId });
              if (!r.ok) {
                setError(r.error);
                return;
              }
              router.refresh();
            });
          }}
        >
          {pending ? "검토 시작 중…" : "검토 시작"}
        </Button>
        {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
      </div>
    );
  }

  // IN_REVIEW
  if (!isMine) {
    return (
      <div className="rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        다른 전문의가 검토 중인 케이스입니다.
      </div>
    );
  }

  const noteTooShort = note.trim().length < 5;
  const decisionMissing = decision.trim().length === 0;
  const submitDisabled = pending || noteTooShort || decisionMissing;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const r = await signOffEscalation({
            id: escalationId,
            decision,
            decisionNote: note,
            familyConsent,
          });
          if (!r.ok) {
            setError(r.error);
            return;
          }
          router.refresh();
        });
      }}
    >
      <div>
        <label className="mb-1 block text-xs font-medium text-foreground">
          결정 항목 <span className="text-red-700">*</span>
        </label>
        <select
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={decision}
          onChange={(e) => setDecision(e.target.value)}
          required
        >
          <option value="">선택해 주세요</option>
          {DECISION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-foreground">
          전문의 의견 <span className="text-red-700">*</span>
          <span className="ml-1 text-muted-foreground">(5자 이상)</span>
        </label>
        <textarea
          rows={5}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="평가·권고 사유·후속 조치 등을 기록"
          required
          minLength={5}
        />
      </div>

      <div className="flex items-start gap-2">
        <input
          id="family-consent"
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-input"
          checked={familyConsent}
          onChange={(e) => setFamilyConsent(e.target.checked)}
        />
        <label htmlFor="family-consent" className="text-xs text-muted-foreground">
          가족 동의 확인 (가족·보호자 통보 또는 동의 절차 진행 여부). 필요 시 체크.
        </label>
      </div>

      <Button type="submit" disabled={submitDisabled}>
        {pending ? "사인오프 중…" : "사인오프"}
      </Button>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </form>
  );
}
