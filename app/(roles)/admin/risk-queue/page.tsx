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
import { listRiskQueue } from "@/lib/actions/risk";

import { RiskActions } from "./_components/actions";

/**
 * /admin/risk-queue — 운영자 위기 큐 (Day 26).
 *
 * D19 acknowledgeRiskFlag 의 UI 공백 닫기. PRD §A1 + §5.3 RiskFlag 상태기.
 * 익명성: 직원 anonymizedId + 부서명만, 실명·이메일 노출 안 함.
 */
export default async function RiskQueuePage({
  searchParams,
}: {
  searchParams: Promise<{
    level?: string;
    status?: string;
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

  const result = await listRiskQueue({
    level: isLevel(params.level) ? params.level : undefined,
    status: isStatus(params.status) ? params.status : undefined,
    fromISO,
    toISO,
    take,
    skip,
  });

  const totalPages = Math.max(1, Math.ceil(result.total / take));

  // 위험도 우선 + 최신순으로 정렬 (DB 의 enum 정렬 한계 — 메모리에서 보정)
  const sorted = [...result.rows].sort((a, b) => {
    const order = ["L4_EMERGENCY", "L3_ESCALATION", "L2_ALERT", "L1_NOTICE"];
    const ai = order.indexOf(a.level);
    const bi = order.indexOf(b.level);
    if (ai !== bi) return ai - bi;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">위기 알림 큐</h1>
        <p className="text-sm text-muted-foreground">
          L1~L4 위기 신호 통합. ACK 또는 디스미스(사유 입력 필수). L3 는 전문의 큐로 자동 이관(ESCALATED).
        </p>
      </header>

      {/* 필터 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">필터</CardTitle>
          <CardDescription>URL 쿼리로 직렬화.</CardDescription>
        </CardHeader>
        <CardContent>
          <form method="GET" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FilterSelect
              name="level"
              label="위험도"
              value={params.level ?? ""}
              options={[
                { v: "L1_NOTICE", l: "L1 주의" },
                { v: "L2_ALERT", l: "L2 경고" },
                { v: "L3_ESCALATION", l: "L3 위기" },
                { v: "L4_EMERGENCY", l: "L4 응급" },
              ]}
            />
            <FilterSelect
              name="status"
              label="상태"
              value={params.status ?? ""}
              options={[
                { v: "PENDING", l: "대기" },
                { v: "ACKNOWLEDGED", l: "확인됨" },
                { v: "ESCALATED", l: "전문의 큐" },
                { v: "RESOLVED", l: "종결" },
                { v: "DISMISSED", l: "디스미스" },
              ]}
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
                <Link href="/admin/risk-queue">초기화</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* 결과 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            큐 ({result.total.toLocaleString()}건)
          </CardTitle>
          <CardDescription>
            {result.total === 0
              ? "조건에 맞는 위기 플래그가 없습니다 — 안정 상태."
              : `${skip + 1} – ${Math.min(skip + sorted.length, result.total)} 표시 (페이지 ${page} / ${totalPages})`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sorted.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              표시할 위기 신호가 없습니다.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="py-2 text-left">위험도</th>
                    <th className="py-2 text-left">상태</th>
                    <th className="py-2 text-left">대상 (익명)</th>
                    <th className="py-2 text-left">부서</th>
                    <th className="py-2 text-left">키워드</th>
                    <th className="py-2 text-left">요약</th>
                    <th className="py-2 text-left">감지 시각</th>
                    <th className="py-2 text-left">처리</th>
                    <th className="py-2 text-left">액션</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r) => (
                    <tr key={r.id} className="border-b border-border last:border-0 align-top">
                      <td className="py-2">
                        <span
                          className={`inline-block rounded-md px-1.5 py-0.5 text-[10px] font-medium ${LEVEL_PILL[r.level]}`}
                        >
                          {LEVEL_LABEL[r.level] ?? r.level}
                        </span>
                        {r.hasEscalation && (
                          <span className="ml-1 text-[10px] text-brand-700">↗ 전문의 큐</span>
                        )}
                      </td>
                      <td className="py-2">
                        <span
                          className={`inline-block rounded-md px-1.5 py-0.5 text-[10px] font-medium ${STATUS_PILL[r.status] ?? "bg-muted"}`}
                        >
                          {STATUS_LABEL[r.status] ?? r.status}
                        </span>
                      </td>
                      <td className="py-2 font-mono text-[10px]">
                        {r.subjectAnonymizedId.slice(0, 10)}…
                      </td>
                      <td className="py-2">{r.subjectDepartment ?? "—"}</td>
                      <td className="py-2">
                        {r.signals?.keywords?.length
                          ? r.signals.keywords.slice(0, 3).join(", ")
                          : "—"}
                      </td>
                      <td className="py-2 max-w-xs truncate">{r.summary ?? "—"}</td>
                      <td className="py-2 whitespace-nowrap font-mono">
                        {fmtKST(r.createdAt)}
                      </td>
                      <td className="py-2 text-[10px]">
                        {r.acknowledgedAt
                          ? `${r.acknowledgedByEmail ?? "?"} · ${fmtKST(r.acknowledgedAt)}`
                          : "—"}
                      </td>
                      <td className="py-2">
                        <RiskActions
                          id={r.id}
                          canAck={r.status === "PENDING"}
                          // L3 는 전문의 사인오프가 종결 — 디스미스 불가 (false positive 결정은 전문의)
                          canDismiss={r.status === "PENDING" && r.level !== "L3_ESCALATION"}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

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

const LEVEL_LABEL: Record<string, string> = {
  L1_NOTICE: "L1 주의",
  L2_ALERT: "L2 경고",
  L3_ESCALATION: "L3 위기",
  L4_EMERGENCY: "L4 응급",
};
const LEVEL_PILL: Record<string, string> = {
  L1_NOTICE: "bg-amber-50 text-amber-800",
  L2_ALERT: "bg-orange-100 text-orange-900",
  L3_ESCALATION: "bg-red-100 text-red-900",
  L4_EMERGENCY: "bg-red-700 text-white",
};
const STATUS_LABEL: Record<string, string> = {
  PENDING: "대기",
  ACKNOWLEDGED: "확인됨",
  ESCALATED: "전문의 큐",
  RESOLVED: "종결",
  DISMISSED: "디스미스",
};
const STATUS_PILL: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-800",
  ACKNOWLEDGED: "bg-emerald-50 text-emerald-800",
  ESCALATED: "bg-brand-50 text-brand-700",
  RESOLVED: "bg-muted text-muted-foreground",
  DISMISSED: "bg-muted text-muted-foreground",
};

function isLevel(v: string | undefined): v is "L1_NOTICE" | "L2_ALERT" | "L3_ESCALATION" | "L4_EMERGENCY" {
  return v === "L1_NOTICE" || v === "L2_ALERT" || v === "L3_ESCALATION" || v === "L4_EMERGENCY";
}

function isStatus(v: string | undefined): v is "PENDING" | "ACKNOWLEDGED" | "ESCALATED" | "RESOLVED" | "DISMISSED" {
  return (
    v === "PENDING" ||
    v === "ACKNOWLEDGED" ||
    v === "ESCALATED" ||
    v === "RESOLVED" ||
    v === "DISMISSED"
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
  options: Array<{ v: string; l: string }>;
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
          <option key={o.v} value={o.v}>
            {o.l}
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
  params: { level?: string; status?: string; from?: string; to?: string },
  page: number,
): string {
  const u = new URLSearchParams();
  if (params.level) u.set("level", params.level);
  if (params.status) u.set("status", params.status);
  if (params.from) u.set("from", params.from);
  if (params.to) u.set("to", params.to);
  u.set("page", String(page));
  return `/admin/risk-queue?${u.toString()}`;
}

function toISOOrUndefined(input: string): string | undefined {
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
    hour12: false,
  });
}
