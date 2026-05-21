import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { authOptions } from "@/lib/auth";
import { getEscalation } from "@/lib/actions/escalation";

import { SlaCountdown } from "../sla-countdown";
import { SignOffForm } from "./signoff-form";

const KST = "Asia/Seoul";

function formatKST(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleString("ko-KR", {
    timeZone: KST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

const SOURCE_LABEL: Record<string, string> = {
  ASSESSMENT_RESPONSE: "자가진단",
  SESSION_MESSAGE: "세션 메시지",
  CLINICAL_NOTE: "임상 노트",
};

const DECISION_LABEL: Record<string, string> = {
  follow_up_2w: "2주 내 후속 세션 권고",
  medication_consult: "약물 상담 의뢰",
  external_referral: "외부 전문 기관 의뢰",
  no_immediate_action: "긴급 조치 불필요 (모니터링)",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PsychiatristQueueDetailPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  if (
    session?.user.role !== "PSYCHIATRIST" &&
    session?.user.role !== "ADMIN"
  ) {
    redirect("/403");
  }

  const { id } = await params;
  const result = await getEscalation({ id });

  if (!result.ok) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>접근할 수 없습니다</CardTitle>
            <CardDescription>{result.error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="sm">
              <Link href="/psychiatrist/queue">큐로 돌아가기</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const e = result.escalation;
  const isMine = e.reviewerId === session.user.id;
  const keywords = e.riskFlag.signals?.keywords ?? [];

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <Link
            href="/psychiatrist/queue"
            className="text-xs text-muted-foreground hover:underline"
          >
            ← 큐로 돌아가기
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">
            에스컬레이션 상세
          </h1>
          <p className="text-sm text-muted-foreground">
            대상(익명): <span className="font-mono">{e.subject.anonymizedId}</span>
          </p>
        </div>
        <div className="text-right">
          <SlaCountdown slaDueAt={e.slaDueAt.toISOString()} status={e.status} />
          <p className="mt-1 text-xs text-muted-foreground">
            SLA 마감: {formatKST(e.slaDueAt)}
          </p>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">위기 신호 요약</CardTitle>
            <CardDescription>
              출처: {SOURCE_LABEL[e.riskFlag.sourceType] ?? e.riskFlag.sourceType}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="whitespace-pre-wrap text-foreground">
              {e.riskFlag.summary ?? "요약 없음"}
            </p>
            {keywords.length > 0 && (
              <div>
                <p className="mb-1 text-xs text-muted-foreground">감지 키워드</p>
                <div className="flex flex-wrap gap-1">
                  {keywords.map((k, i) => (
                    <span
                      key={i}
                      className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-800"
                    >
                      {k}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {e.riskFlag.signals?.snippet && (
              <div>
                <p className="mb-1 text-xs text-muted-foreground">원문 일부</p>
                <p className="rounded-md border border-border bg-muted/40 p-2 text-xs font-mono whitespace-pre-wrap">
                  {e.riskFlag.signals.snippet}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">처리 상태</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="상태" value={STATUS_LABEL[e.status] ?? e.status} />
            <Row label="접수" value={formatKST(e.createdAt)} />
            <Row label="SLA 마감" value={formatKST(e.slaDueAt)} />
            <Row label="검토자" value={e.reviewerName ?? "미배정"} />
            <Row label="검토 시작" value={formatKST(e.reviewStartedAt)} />
            {e.status === "DECIDED" && (
              <>
                <Row label="사인오프" value={formatKST(e.decidedAt)} />
                <Row
                  label="결정 항목"
                  value={e.decision ? (DECISION_LABEL[e.decision] ?? e.decision) : "—"}
                />
                <Row label="가족 동의" value={e.familyConsent ? "확인" : "미확인"} />
                {e.decisionNote && (
                  <div className="pt-1">
                    <p className="text-xs text-muted-foreground">의견</p>
                    <p className="mt-1 whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-2 text-xs">
                      {e.decisionNote}
                    </p>
                  </div>
                )}
              </>
            )}
            {e.status === "EXPIRED" && (
              <Row label="SLA 만료 처리" value={formatKST(e.expiredAt)} />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">사인오프</CardTitle>
          <CardDescription>
            결정 항목·의견을 입력하면 본 케이스가 DECIDED 로 전이됩니다. 사인오프
            후엔 수정 불가합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignOffForm
            escalationId={e.id}
            status={e.status}
            isMine={isMine}
          />
        </CardContent>
      </Card>
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "대기",
  IN_REVIEW: "검토 중",
  DECIDED: "사인오프",
  EXPIRED: "SLA 만료",
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="w-24 shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}
