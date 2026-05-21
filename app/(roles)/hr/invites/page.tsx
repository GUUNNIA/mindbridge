import { redirect } from "next/navigation";
import Link from "next/link";
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
import { listInvites } from "@/lib/actions/invites";
import { IssueInviteForm } from "./_components/issue-form";
import { RevokeButton } from "./_components/revoke-button";

const KST = "Asia/Seoul";

function formatKST(d: Date): string {
  return d.toLocaleString("ko-KR", {
    timeZone: KST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function statusLabel(row: {
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
}): { label: string; tone: "muted" | "ok" | "warn" | "bad" } {
  if (row.revokedAt) return { label: "폐기됨", tone: "bad" };
  if (row.usedAt) return { label: "사용 완료", tone: "ok" };
  if (row.expiresAt < new Date()) return { label: "만료", tone: "muted" };
  return { label: "유효", tone: "warn" };
}

export default async function HRInvitesPage() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "HR") redirect("/403");

  const invites = await listInvites({ take: 50 });

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">초대코드 발급</h1>
          <p className="text-sm text-muted-foreground">
            발급 후 30일 유효 · 1회용 · 가입 완료 시 자동 소진
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/hr">← HR 대시보드</Link>
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">새 코드 발급</CardTitle>
          <CardDescription>
            이메일 지정 시 가입 단계에서 해당 이메일만 사용 가능. 비워두면 누구나 사용 가능.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <IssueInviteForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">발급 이력 (최근 {invites.length}건)</CardTitle>
          <CardDescription>본사 회사 단위. 만료·사용·폐기 상태로 자동 필터링.</CardDescription>
        </CardHeader>
        <CardContent>
          {invites.length === 0 ? (
            <p className="text-sm text-muted-foreground">아직 발급한 코드가 없습니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="py-2 pr-3 font-medium">코드</th>
                    <th className="py-2 pr-3 font-medium">대상 이메일</th>
                    <th className="py-2 pr-3 font-medium">발급일 (KST)</th>
                    <th className="py-2 pr-3 font-medium">만료 (KST)</th>
                    <th className="py-2 pr-3 font-medium">상태</th>
                    <th className="py-2 pr-3 font-medium">조치</th>
                  </tr>
                </thead>
                <tbody>
                  {invites.map((r) => {
                    const s = statusLabel(r);
                    const canRevoke = !r.usedAt && !r.revokedAt && r.expiresAt >= new Date();
                    return (
                      <tr key={r.id} className="border-b border-border last:border-0">
                        <td className="py-2 pr-3 font-mono text-xs">{r.code}</td>
                        <td className="py-2 pr-3 text-muted-foreground">
                          {r.email ?? <span className="italic">미지정</span>}
                        </td>
                        <td className="py-2 pr-3 text-muted-foreground">{formatKST(r.createdAt)}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{formatKST(r.expiresAt)}</td>
                        <td className="py-2 pr-3">
                          <StatusPill tone={s.tone}>{s.label}</StatusPill>
                        </td>
                        <td className="py-2 pr-3">
                          {canRevoke ? (
                            <RevokeButton id={r.id} code={r.code} />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusPill({
  tone,
  children,
}: {
  tone: "muted" | "ok" | "warn" | "bad";
  children: React.ReactNode;
}) {
  const cls = {
    muted: "bg-muted text-muted-foreground",
    ok: "bg-emerald-100 text-emerald-800",
    warn: "bg-brand-50 text-brand-700",
    bad: "bg-destructive/10 text-destructive",
  }[tone];
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${cls}`}>{children}</span>
  );
}
