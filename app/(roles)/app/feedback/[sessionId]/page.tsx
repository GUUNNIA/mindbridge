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
import { prisma } from "@/lib/db";
import { getFeedback } from "@/lib/actions/feedback";

const KST = "Asia/Seoul";

function formatKST(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleString("ko-KR", {
    timeZone: KST,
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

import { FeedbackForm } from "./feedback-form";

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export default async function FeedbackPage({ params }: PageProps) {
  const { sessionId } = await params;
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "EMPLOYEE") redirect("/403");

  const row = await prisma.session.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      status: true,
      endedAt: true,
      employeeId: true,
      counselor: { select: { nickname: true } },
    },
  });

  if (!row) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>세션을 찾을 수 없습니다</CardTitle>
          <CardDescription>잘못된 링크일 수 있어요.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" size="sm">
            <Link href="/app">홈으로</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (row.employeeId !== session.user.id) {
    redirect("/403");
  }

  if (row.status !== "COMPLETED") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>아직 종료되지 않은 세션이에요</CardTitle>
          <CardDescription>
            세션이 종료된 다음 다시 와 주세요. (현재 상태: {row.status})
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" size="sm">
            <Link href={`/session/${row.id}`}>세션룸으로</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // 이미 작성한 피드백이 있는지 확인
  const existing = await getFeedback({ sessionId: row.id });
  if (existing.ok && existing.feedback) {
    const fb = existing.feedback;
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-foreground">제출 완료</h1>
          <p className="text-sm text-muted-foreground">
            {row.counselor.nickname ?? "상담사"} 상담사와의 세션에 대한 피드백이 저장됐어요.
          </p>
        </header>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">내가 남긴 피드백</CardTitle>
            <CardDescription>제출 일시: {formatKST(fb.createdAt)} (KST)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="평점" value={`${"★".repeat(fb.rating)}${"☆".repeat(5 - fb.rating)} (${fb.rating}점)`} />
            <Row
              label="재예약 의사"
              value={fb.wantSameCounselor ? "다음에도 같은 상담사와" : "선택 안 함"}
            />
            {fb.comment && (
              <div>
                <p className="text-xs text-muted-foreground">코멘트</p>
                <p className="mt-1 whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-2 text-sm">
                  {fb.comment}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        <Button asChild variant="outline">
          <Link href="/app">홈으로</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">세션 피드백</h1>
        <p className="text-sm text-muted-foreground">
          {row.counselor.nickname ?? "상담사"} 상담사와의 세션 — 종료: {formatKST(row.endedAt)} (KST)
        </p>
      </header>

      <Card>
        <CardContent className="pt-6">
          <FeedbackForm
            sessionId={row.id}
            counselorNickname={row.counselor.nickname ?? "상담사"}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="w-24 shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}
