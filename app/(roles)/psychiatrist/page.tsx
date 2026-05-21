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
import { listEscalations } from "@/lib/actions/escalation";

import { SlaCountdown } from "./queue/sla-countdown";

const KST = "Asia/Seoul";

function formatKST(d: Date): string {
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

export default async function PsychiatristHome() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "PSYCHIATRIST") redirect("/403");

  const rows = await listEscalations();
  const pendingCount = rows.filter((r) => r.status === "PENDING").length;
  const myInReview = rows.filter(
    (r) => r.status === "IN_REVIEW" && r.reviewerId === session.user.id,
  );
  const top3 = rows
    .filter((r) => r.status === "PENDING" || r.status === "IN_REVIEW")
    .slice(0, 3);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">전문의 홈</h1>
        <p className="text-sm text-muted-foreground">
          {session.user.name ?? session.user.email} 님, 에스컬레이션 큐를 확인하세요.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>에스컬레이션 큐</CardTitle>
            <CardDescription>위기 케이스 — SLA 임박 순 정렬</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-baseline gap-4">
              <div>
                <div className="text-xs text-muted-foreground">대기</div>
                <div className="text-2xl font-semibold text-amber-700">{pendingCount}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">내 검토 중</div>
                <div className="text-2xl font-semibold text-brand-700">
                  {myInReview.length}
                </div>
              </div>
            </div>
            <Button asChild size="sm">
              <Link href="/psychiatrist/queue">큐 열기</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>SLA 임박 (상위 3)</CardTitle>
            <CardDescription>전체 큐에서 SLA 만료가 가장 가까운 케이스</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {top3.length === 0 ? (
              <p className="text-muted-foreground">대기 중인 케이스가 없습니다.</p>
            ) : (
              top3.map((r) => (
                <Link
                  key={r.id}
                  href={`/psychiatrist/queue/${r.id}`}
                  className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-xs hover:bg-muted/40"
                >
                  <div className="flex flex-col">
                    <span className="font-mono">{r.subject.anonymizedId.slice(0, 10)}</span>
                    <span className="text-muted-foreground">{formatKST(r.createdAt)}</span>
                  </div>
                  <SlaCountdown slaDueAt={r.slaDueAt.toISOString()} status={r.status} />
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
