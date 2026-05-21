"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  generateDraftFromMemo,
  saveClinicalNote,
  type ClinicalNoteView,
} from "@/lib/actions/clinical-notes";

const FLAG_LABEL: Record<string, string> = {
  RISK_SUICIDAL: "자살 사고",
  RISK_SELF_HARM: "자해",
  FAMILY_CONFLICT: "가족 갈등",
  WORK_BURNOUT: "직장 번아웃",
  SLEEP_DISTURBANCE: "수면 장애",
  FOLLOW_UP_RECOMMENDED: "후속 권고",
};

export function NoteEditor({
  sessionId,
  initial,
}: {
  sessionId: string;
  initial: ClinicalNoteView | null;
}) {
  const router = useRouter();
  const [memo, setMemo] = useState("");
  const [subjective, setSubjective] = useState(initial?.subjective ?? "");
  const [objective, setObjective] = useState(initial?.objective ?? "");
  const [assessmentText, setAssessmentText] = useState(initial?.assessmentText ?? "");
  const [plan, setPlan] = useState(initial?.plan ?? "");
  const [summaryForEmployee, setSummaryForEmployee] = useState(
    initial?.summaryForEmployee ?? "",
  );
  const [flags, setFlags] = useState<string[]>(initial?.flags ?? []);
  const [providerKind, setProviderKind] = useState<"claude" | "mock" | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(initial?.updatedAt ?? null);
  const [error, setError] = useState<string | null>(null);
  const [pendingGen, startGen] = useTransition();
  const [pendingSave, startSave] = useTransition();
  const [status, setStatus] = useState<"DRAFT" | "FINALIZED">(initial?.status ?? "DRAFT");
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    if (!savedFlash) return;
    const id = setTimeout(() => setSavedFlash(false), 2500);
    return () => clearTimeout(id);
  }, [savedFlash]);

  function onGenerate() {
    setError(null);
    startGen(async () => {
      const r = await generateDraftFromMemo({ sessionId, memo });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setSubjective(r.draft.subjective);
      setObjective(r.draft.objective);
      setAssessmentText(r.draft.assessment);
      setPlan(r.draft.plan);
      setSummaryForEmployee(r.draft.summaryForEmployee);
      setFlags(r.draft.flags);
      setProviderKind(r.provider);
    });
  }

  function onSave(nextStatus: "DRAFT" | "FINALIZED") {
    setError(null);
    startSave(async () => {
      const r = await saveClinicalNote({
        sessionId,
        subjective,
        objective,
        assessmentText,
        plan,
        summaryForEmployee,
        flags,
        status: nextStatus,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setStatus(r.status);
      setSavedAt(new Date());
      if (r.status === "FINALIZED") {
        // 확정 = 노트 작성 종료 → 케이스 목록으로 (디자이너 결정 2026-05-21)
        router.push("/counselor/cases");
      } else {
        // 초안 = 계속 작성 흐름 — 페이지 머무름, "✓ 저장됨" 토스트 2.5초
        setSavedFlash(true);
        router.refresh();
      }
    });
  }

  const pending = pendingGen || pendingSave;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">메모 → SOAP 초안 생성</CardTitle>
          <CardDescription>
            한 줄 메모를 적고 "SOAP 생성" 을 누르면 자가진단·세션 transcript 와 함께
            generate_soap tool 이 호출됩니다 (mock 모드일 경우 결정적 키워드 기반).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="예: 내담자가 수면 부족·업무 압박을 호소함. 일부 무기력 증상 보고."
            rows={3}
            disabled={pending}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
          />
        </CardContent>
        <CardFooter className="flex flex-wrap items-center gap-2">
          <Button onClick={onGenerate} disabled={pending || !memo.trim()}>
            {pendingGen ? "생성 중…" : "SOAP 생성"}
          </Button>
          {providerKind && (
            <span className="text-xs text-muted-foreground">
              provider: {providerKind}
            </span>
          )}
        </CardFooter>
      </Card>

      <Field
        id="subjective"
        label="S (Subjective)"
        hint="내담자의 주관적 진술"
        value={subjective}
        onChange={setSubjective}
        disabled={pending}
        rows={4}
      />
      <Field
        id="objective"
        label="O (Objective)"
        hint="상담사가 관찰한 행동·태도"
        value={objective}
        onChange={setObjective}
        disabled={pending}
        rows={3}
      />
      <Field
        id="assessment"
        label="A (Assessment)"
        hint="임상 인상·평가"
        value={assessmentText}
        onChange={setAssessmentText}
        disabled={pending}
        rows={3}
      />
      <Field
        id="plan"
        label="P (Plan)"
        hint="후속 권고·과제·다음 회기 계획"
        value={plan}
        onChange={setPlan}
        disabled={pending}
        rows={3}
      />
      <Field
        id="summary"
        label="직원용 요약"
        hint="직원이 직접 볼 요약. SOAP 본문은 직원에게 노출되지 않습니다."
        value={summaryForEmployee}
        onChange={setSummaryForEmployee}
        disabled={pending}
        rows={3}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">위험 마커 (flags)</CardTitle>
          <CardDescription>
            자동 감지된 마커. 토글로 수동 조정 가능. RISK_SUICIDAL 은 D19 위기 흐름 트리거.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {Object.entries(FLAG_LABEL).map(([key, label]) => {
            const on = flags.includes(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() =>
                  setFlags((prev) => (on ? prev.filter((f) => f !== key) : [...prev, key]))
                }
                disabled={pending}
                className={[
                  "rounded-full border px-3 py-1 text-xs transition",
                  on
                    ? "border-brand-700 bg-brand-50 text-brand-700"
                    : "border-border bg-background text-muted-foreground hover:bg-muted/40",
                  pending && "opacity-50 cursor-not-allowed",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {label}
              </button>
            );
          })}
        </CardContent>
      </Card>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="sticky bottom-0 -mx-1 flex flex-wrap items-center justify-between gap-2 border-t border-border bg-background/90 px-1 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <p className="text-xs text-muted-foreground">
            상태: {status === "FINALIZED" ? "확정" : "초안"}
            {savedAt && ` · 저장 ${savedAt.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", hour12: false })}`}
          </p>
          {savedFlash && (
            <span
              role="status"
              aria-live="polite"
              className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 animate-in fade-in slide-in-from-top-1"
            >
              ✓ 저장됨
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onSave("DRAFT")} disabled={pending}>
            {pendingSave && status !== "FINALIZED" ? "저장 중…" : "초안 저장"}
          </Button>
          <Button onClick={() => onSave("FINALIZED")} disabled={pending}>
            {pendingSave && status === "FINALIZED" ? "확정 중…" : "확정 저장"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  hint,
  value,
  onChange,
  disabled,
  rows,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  rows: number;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <p className="text-xs text-muted-foreground">{hint}</p>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        disabled={disabled}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
      />
    </div>
  );
}
