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
import { searchAuditLogs, listAuditLogFacets } from "@/lib/actions/audit";

/**
 * /admin/audit-logs — 운영자 감사 로그 검색 (Day 25).
 *
 * 필터: actor (이메일 텍스트), resourceType, action, 기간.
 * URL 쿼리 기반(?action=...&resourceType=...&from=ISO&to=ISO&page=N).
 * 페이징은 단순 ?page=1,2,... (50건/페이지).
 */
export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{
    action?: string;
    resourceType?: string;
    actorId?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") redirect("/403");

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const take = 50;
  const skip = (page - 1) * take;

  const fromISO = params.from ? toISOOrUndefined(params.from) : undefined;
  const toISO = params.to ? toISOOrUndefined(params.to) : undefined;

  const [result, facets] = await Promise.all([
    searchAuditLogs({
      action: params.action,
      resourceType: params.resourceType,
      actorId: params.actorId,
      fromISO,
      toISO,
      take,
      skip,
    }),
    listAuditLogFacets(),
  ]);

  const totalPages = Math.max(1, Math.ceil(result.total / take));

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">감사 로그</h1>
        <p className="text-sm text-muted-foreground">
          민감 접근·권한 위반·리포트 발행·시스템 이벤트 추적. 시간순 정렬, 50건/페이지.
        </p>
      </header>

      {/* 필터 폼 (URL GET) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">필터</CardTitle>
          <CardDescription>모든 필터는 URL 쿼리로 직렬화됩니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <form method="GET" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FilterSelect
              name="action"
              label="Action"
              value={params.action ?? ""}
              options={facets.actions}
            />
            <FilterSelect
              name="resourceType"
              label="Resource Type"
              value={params.resourceType ?? ""}
              options={facets.resourceTypes}
            />
            <FilterInput
              name="from"
              label="시작 (YYYY-MM-DD)"
              value={params.from ?? ""}
              placeholder="2026-05-01"
            />
            <FilterInput
              name="to"
              label="종료 (YYYY-MM-DD)"
              value={params.to ?? ""}
              placeholder="2026-06-01"
            />
            <div className="col-span-full flex gap-2">
              <Button type="submit" size="sm">
                필터 적용
              </Button>
              <Button asChild type="button" variant="outline" size="sm">
                <Link href="/admin/audit-logs">초기화</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* 결과 표 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            결과 ({result.total.toLocaleString()}건)
          </CardTitle>
          <CardDescription>
            {result.total === 0
              ? "조건에 맞는 로그가 없습니다."
              : `${skip + 1} – ${Math.min(skip + result.rows.length, result.total)} 표시 (페이지 ${page} / ${totalPages})`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {result.rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              표시할 로그가 없습니다.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="py-2 text-left">시각 (KST)</th>
                    <th className="py-2 text-left">Actor</th>
                    <th className="py-2 text-left">Action</th>
                    <th className="py-2 text-left">Resource</th>
                    <th className="py-2 text-left">Resource ID</th>
                    <th className="py-2 text-left">Metadata</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((r) => (
                    <tr key={r.id} className="border-b border-border last:border-0">
                      <td className="py-2 align-top whitespace-nowrap font-mono">
                        {fmtKST(r.timestamp)}
                      </td>
                      <td className="py-2 align-top">
                        {r.actorEmail ? (
                          <span>
                            {r.actorEmail}
                            <span className="ml-1 text-muted-foreground">
                              ({r.actorRole ?? "?"})
                            </span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">system</span>
                        )}
                      </td>
                      <td className="py-2 align-top">
                        <span
                          className={`inline-block rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                            r.action === "PERMISSION_DENIED"
                              ? "bg-red-50 text-red-800"
                              : "bg-muted text-foreground"
                          }`}
                        >
                          {r.action}
                        </span>
                      </td>
                      <td className="py-2 align-top">{r.resourceType}</td>
                      <td className="py-2 align-top font-mono text-[10px]">
                        {truncate(r.resourceId, 36)}
                      </td>
                      <td className="py-2 align-top">
                        {r.metadata ? (
                          <pre className="max-w-md overflow-hidden whitespace-pre-wrap break-words text-[10px] text-muted-foreground">
                            {JSON.stringify(r.metadata, null, 0).slice(0, 200)}
                          </pre>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 페이지네이션 */}
      {result.total > take && (
        <div className="flex gap-2">
          {page > 1 && (
            <Button asChild variant="outline" size="sm">
              <Link href={pageUrl(params, page - 1)}>이전</Link>
            </Button>
          )}
          {page < totalPages && (
            <Button asChild variant="outline" size="sm">
              <Link href={pageUrl(params, page + 1)}>다음</Link>
            </Button>
          )}
        </div>
      )}

      <div>
        <Button asChild variant="outline">
          <Link href="/admin">운영자 홈으로</Link>
        </Button>
      </div>
    </div>
  );
}

function FilterSelect({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string;
  options: string[];
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <select
        name={name}
        defaultValue={value}
        className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
      >
        <option value="">전체</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function FilterInput({
  name,
  label,
  value,
  placeholder,
}: {
  name: string;
  label: string;
  value: string;
  placeholder: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <input
        type="text"
        name={name}
        defaultValue={value}
        placeholder={placeholder}
        className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
      />
    </label>
  );
}

function pageUrl(
  params: { action?: string; resourceType?: string; actorId?: string; from?: string; to?: string },
  page: number,
): string {
  const u = new URLSearchParams();
  if (params.action) u.set("action", params.action);
  if (params.resourceType) u.set("resourceType", params.resourceType);
  if (params.actorId) u.set("actorId", params.actorId);
  if (params.from) u.set("from", params.from);
  if (params.to) u.set("to", params.to);
  u.set("page", String(page));
  return `/admin/audit-logs?${u.toString()}`;
}

function toISOOrUndefined(input: string): string | undefined {
  // YYYY-MM-DD 입력 → UTC 자정 ISO (간단 변환)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return undefined;
  return `${input}T00:00:00.000Z`;
}

function fmtKST(d: Date): string {
  return d.toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}
