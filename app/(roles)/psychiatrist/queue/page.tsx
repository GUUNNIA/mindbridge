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

import { SlaCountdown } from "./sla-countdown";

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

const STATUS_LABEL: Record<string, string> = {
  PENDING: "대기",
  IN_REVIEW: "검토 중",
  DECIDED: "사인오프",
  EXPIRED: "SLA 만료",
};

const STATUS_PILL: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-800",
  IN_REVIEW: "bg-brand-50 text-brand-700",
  DECIDED: "bg-emerald-50 text-emerald-800",
  EXPIRED: "bg-red-50 text-red-800",
};

export default async function PsychiatristQueuePage() {
  const session = await getServerSession(authOptions);
  if (
    session?.user.role !== "PSYCHIATRIST" &&
    session?.user.role !== "ADMIN"
  ) {
    redirect("/403");
  }

  const rows = await listEscalations();

  const pending = rows.filter((r) => r.status === "PENDING");
  const inReview = rows.filter((r) => r.status === "IN_REVIEW");
  const closed = rows.filter(
    (r) => r.status === "DECIDED" || r.status === "EXPIRED",
  );
  // 본인이 잡고 있던 EXPIRED 케이스 (PSYCHIATRIST 만 — ADMIN 은 전체 모니터링)
  const myExpired =
    session.user.role === "PSYCHIATRIST"
      ? rows.filter(
          (r) => r.status === "EXPIRED" && r.reviewerId === session.user.id,
        )
      : [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">에스컬레이션 큐</h1>
        <p className="text-sm text-muted-foreground">
          L3 위기 케이스 — 24시간 내 사인오프 필요. SLA 임박 케이스가 큐 상단에 정렬됩니다.
        </p>
      </header>

      {myExpired.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm">
          <p className="font-medium text-red-900">
            내가 검토 중이던 케이스 {myExpired.length}건이 SLA 만료됐어요.
          </p>
          <p className="mt-1 text-red-800">
            운영자가 후속 조치를 진행 중입니다. 본인 큐에는 24시간 동안 표시됩니다.
          </p>
        </div>
      )}

      <div className="grid gap-3 text-sm md:grid-cols-3">
        <SummaryCard label="대기" count={pending.length} tone="warning" />
        <SummaryCard label="검토 중" count={inReview.length} tone="brand" />
        <SummaryCard label="완료/만료" count={closed.length} tone="muted" />
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>큐가 비어 있습니다</CardTitle>
            <CardDescription>
              자가진단·세션·임상 노트에서 L3 위기 신호가 감지되면 자동으로 큐에 들어옵니다.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-3 py-2 font-medium">상태</th>
                  <th className="px-3 py-2 font-medium">SLA 잔여</th>
                  <th className="px-3 py-2 font-medium">접수 (KST)</th>
                  <th className="px-3 py-2 font-medium">대상 (익명)</th>
                  <th className="px-3 py-2 font-medium">신호 출처</th>
                  <th className="px-3 py-2 font-medium">요약</th>
                  <th className="px-3 py-2 font-medium">조치</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0 align-top">
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs ${STATUS_PILL[r.status] ?? "bg-muted text-muted-foreground"}`}
                      >
                        {STATUS_LABEL[r.status] ?? r.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <SlaCountdown
                        slaDueAt={r.slaDueAt.toISOString()}
                        status={r.status}
                      />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                      {formatKST(r.createdAt)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap font-mono text-xs">
                      {r.subject.anonymizedId.slice(0, 10)}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {SOURCE_LABEL[r.riskFlag.sourceType] ?? r.riskFlag.sourceType}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      <span className="line-clamp-2">{r.riskFlag.summary ?? "—"}</span>
                    </td>
                    <td className="px-3 py-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/psychiatrist/queue/${r.id}`}>상세</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

const SOURCE_LABEL: Record<string, string> = {
  ASSESSMENT_RESPONSE: "자가진단",
  SESSION_MESSAGE: "세션 메시지",
  CLINICAL_NOTE: "임상 노트",
};

function SummaryCard({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: "warning" | "brand" | "muted";
}) {
  const cls =
    tone === "warning"
      ? "bg-amber-50 text-amber-900 border-amber-200"
      : tone === "brand"
        ? "bg-brand-50 text-brand-800 border-brand-200"
        : "bg-muted text-foreground border-border";
  return (
    <div className={`rounded-md border p-3 ${cls}`}>
      <div className="text-xs">{label}</div>
      <div className="text-2xl font-semibold">{count}</div>
    </div>
  );
}
