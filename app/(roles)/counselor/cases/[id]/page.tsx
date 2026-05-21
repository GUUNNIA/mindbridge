import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { authOptions } from "@/lib/auth";
import { getCounselorCase } from "@/lib/actions/counselor-cases";
import { enterSessionFromBooking } from "@/lib/actions/session";

const KST = "Asia/Seoul";

function formatKST(d: Date): string {
  return d.toLocaleString("ko-KR", {
    timeZone: KST,
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("ko-KR", {
    timeZone: KST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

const STATUS_LABEL: Record<string, string> = {
  REQUESTED: "요청됨",
  CONFIRMED: "확정",
  IN_SESSION: "진행 중",
  COMPLETED: "완료",
  CANCELED_BY_USER: "취소(직원)",
  CANCELED_BY_COUNSELOR: "취소(상담사)",
  NO_SHOW: "미입장",
};

const SEVERITY_LABEL: Record<string, string> = {
  NONE: "없음",
  MILD: "약함",
  MODERATE: "보통",
  MODERATELY_SEVERE: "다소 심함",
  SEVERE: "심각",
};

function canEnterSession(status: string): boolean {
  return (
    status !== "CANCELED_BY_USER" &&
    status !== "CANCELED_BY_COUNSELOR" &&
    status !== "NO_SHOW" &&
    status !== "COMPLETED"
  );
}

export default async function CounselorCaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "COUNSELOR") redirect("/403");

  const { id } = await params;
  const result = await getCounselorCase({ bookingId: id });
  if (!result.ok) notFound();
  const c = result.case;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <Button asChild variant="outline" size="sm" className="w-fit">
        <Link href="/counselor/cases">← 케이스 목록</Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl text-brand-700">
            {c.employee.nickname ?? "이름 없음"} 님 케이스
          </CardTitle>
          <CardDescription>
            예약 ID: {c.bookingId.slice(0, 8)}… · {formatKST(c.scheduledAt)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row label="예약 상태">{STATUS_LABEL[c.status] ?? c.status}</Row>
          {c.cancelReason && <Row label="취소 사유">{c.cancelReason}</Row>}
          <Row label="세션 상태">
            {c.session ? `${c.session.status}${c.session.startedAt ? ` · 시작 ${formatKST(c.session.startedAt)}` : ""}` : "미생성"}
          </Row>
        </CardContent>
        <CardFooter>
          {canEnterSession(c.status) ? (
            <form action={enterSessionFromBooking.bind(null, c.bookingId)} className="w-full">
              <Button type="submit" className="w-full">
                세션 입장
              </Button>
            </form>
          ) : (
            <Button disabled className="w-full">
              세션 입장 (취소된 케이스)
            </Button>
          )}
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">자가진단 요약</CardTitle>
          <CardDescription>
            직원의 최근 완료된 자가진단. 상담사용 요약(`summaryForCounselor`)을 표시합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {c.assessment ? (
            <>
              <Row label="1차 카테고리">{c.assessment.primaryCategoryName ?? "분류 없음"}</Row>
              {c.assessment.secondaryCategoryNames.length > 0 && (
                <Row label="2차 카테고리">{c.assessment.secondaryCategoryNames.join(", ")}</Row>
              )}
              <Row label="심각도">
                {c.assessment.severity
                  ? (SEVERITY_LABEL[c.assessment.severity] ?? c.assessment.severity)
                  : "—"}
              </Row>
              {c.assessment.completedAt && (
                <Row label="완료 시각">{formatKST(c.assessment.completedAt)}</Row>
              )}
              {c.assessment.summaryForCounselor && (
                <div className="rounded-md border border-border bg-muted/40 p-3 text-foreground whitespace-pre-wrap">
                  {c.assessment.summaryForCounselor}
                </div>
              )}
            </>
          ) : (
            <p className="text-muted-foreground italic">
              직원이 자가진단을 완료하지 않았습니다.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            임상 노트
            <NoteBadge status={c.noteStatus} />
          </CardTitle>
          <CardDescription>SOAP 형식으로 작성. 메모 1줄에서 자동 초안 생성 가능.</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild className="w-full">
            <Link href={`/counselor/cases/${c.bookingId}/note`}>
              {c.session ? "노트 작성·확인" : "(세션 입장 후 작성 가능)"}
            </Link>
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">이전 노트</CardTitle>
          <CardDescription>
            같은 직원과의 이전 만남 ({c.priorNotes.length}건). 노트 본문은 Day 17 ClinicalNote
            도입 후 활성화됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {c.priorNotes.length === 0 ? (
            <p className="text-muted-foreground italic">이전 만남이 없습니다.</p>
          ) : (
            <ul className="space-y-1">
              {c.priorNotes.map((p) => (
                <li
                  key={p.bookingId}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                >
                  <span className="text-muted-foreground">{formatDate(p.scheduledAt)}</span>
                  <span className="text-xs text-muted-foreground italic">
                    노트 본문은 D17 활성
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border last:border-0 pb-2 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground text-right">{children}</span>
    </div>
  );
}

function NoteBadge({ status }: { status: "DRAFT" | "FINALIZED" | null }) {
  if (status === "FINALIZED") {
    return (
      <span className="inline-block rounded-full bg-brand-50 px-2 py-0.5 text-xs font-normal text-brand-700">
        확정
      </span>
    );
  }
  if (status === "DRAFT") {
    return (
      <span className="inline-block rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
        초안
      </span>
    );
  }
  return (
    <span className="text-xs font-normal text-muted-foreground italic">미작성</span>
  );
}
