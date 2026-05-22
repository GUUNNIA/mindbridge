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
import { getDashboard } from "@/lib/actions/hr";
import { thisMonthUtc } from "@/lib/hr/period";
import type { KMasked } from "@/lib/hr/aggregate";

/**
 * HR 대시보드 (Day 22) — 익명 집계 + k≥5 마스킹.
 *
 * 차트(recharts)는 Day 23 에 추가. 본 단계는 텍스트 카드 + 표로
 * 데이터·마스킹·BR-7 발행 차단 동작을 확인한다.
 */
export default async function HRDashboardPage() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "HR" && session?.user.role !== "ADMIN") {
    redirect("/403");
  }

  const period = thisMonthUtc();
  const result = await getDashboard(period);

  if (!result.ok) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-foreground">HR 대시보드</h1>
          <p className="text-sm text-muted-foreground">
            이번 달 집계 — 발행 조건 미충족으로 표시할 데이터가 없습니다.
          </p>
        </header>
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-amber-900">발행 차단 (BR-7)</CardTitle>
            <CardDescription className="text-amber-800">
              {result.error}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-amber-900 space-y-1">
            <p>
              회사 직원 수 또는 통계 동의자 수가 임계값에 도달하면 익명 집계가
              자동 활성화됩니다.
            </p>
            <p className="text-xs text-amber-800">
              임계값: 직원 ≥ 20명 또는 STATISTICS 동의자 ≥ 10명.
            </p>
          </CardContent>
        </Card>
        <div>
          <Button asChild variant="outline">
            <Link href="/hr">HR 홈으로</Link>
          </Button>
        </div>
      </div>
    );
  }

  const { data, gate } = result;
  const periodStart = new Date(period.startISO);
  const periodEnd = new Date(period.endISO);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">HR 대시보드</h1>
        <p className="text-sm text-muted-foreground">
          이번 달 익명 집계 — k≥5 마스킹 적용. 개인 식별 정보는 표시되지 않습니다.
        </p>
        <p className="text-xs text-muted-foreground">
          기간: {fmtDateKST(periodStart)} ~ {fmtDateKST(periodEnd)} ·
          {gate.ok ? ` 직원 ${gate.headcount}명 / 통계 동의자 ${gate.consenters}명` : ""}
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="이용 직원"
          description="기간 내 자가진단 1회 이상 (동의자 한정)"
          cell={data.activeAssessmentUsers}
          unit="명"
        />
        <MetricCard
          label="자가진단 응답"
          description="기간 내 진단 시작 수"
          cell={data.assessmentCount}
          unit="회"
        />
        <MetricCard
          label="번아웃 비율"
          description="완료된 진단 중 번아웃 카테고리 비중"
          cell={data.burnoutRatePercent}
          unit="%"
        />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">모집단 메타</CardTitle>
            <CardDescription>회사 단위 공개 정보</CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p>전체 직원: {data.totalEmployees}명</p>
            <p>통계 동의자: {data.statisticsConsenters}명</p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">카테고리 분포</CardTitle>
            <CardDescription>
              완료된 자가진단의 primary 카테고리. Day 23 에 차트화됩니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.categoryDistribution.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                기간 내 완료된 자가진단이 없습니다.
              </p>
            ) : (
              <ul className="space-y-1 text-sm">
                {data.categoryDistribution.map((c) => (
                  <li key={c.slug} className="flex justify-between">
                    <span>{c.name}</span>
                    <span className="font-mono">{renderCell(c.count, "회")}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">심각도 분포</CardTitle>
            <CardDescription>
              완료된 자가진단의 severity 분포 (PHQ-9/GAD-7 기준).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {data.severityDistribution.map((s) => (
                <li key={s.severity} className="flex justify-between">
                  <span>{SEVERITY_LABEL[s.severity] ?? s.severity}</span>
                  <span className="font-mono">{renderCell(s.count, "회")}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">부서별 이용</CardTitle>
            <CardDescription>
              부서 인원이 5명 미만이면 해당 부서 셀은 마스킹됩니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 text-left">부서</th>
                  <th className="py-2 text-right">인원</th>
                  <th className="py-2 text-right">이용 직원</th>
                </tr>
              </thead>
              <tbody>
                {data.byDepartment.map((d) => (
                  <tr key={d.departmentId} className="border-b border-border last:border-0">
                    <td className="py-2">{d.name}</td>
                    <td className="py-2 text-right font-mono">{d.headcount}명</td>
                    <td className="py-2 text-right font-mono">
                      {renderCell(d.activeAssessmentUsers, "명")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </section>

      <div>
        <Button asChild variant="outline">
          <Link href="/hr">HR 홈으로</Link>
        </Button>
      </div>
    </div>
  );
}

const SEVERITY_LABEL: Record<string, string> = {
  NONE: "없음",
  MILD: "경미",
  MODERATE: "중등도",
  MODERATELY_SEVERE: "중증",
  SEVERE: "심각",
};

function renderCell(cell: KMasked, unit: string): string {
  if (cell.masked) return "<5명";
  return `${cell.value}${unit}`;
}

function MetricCard({
  label,
  description,
  cell,
  unit,
}: {
  label: string;
  description: string;
  cell: KMasked;
  unit: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{label}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums">
          {cell.masked ? "<5명" : `${cell.value}${unit}`}
        </p>
      </CardContent>
    </Card>
  );
}

function fmtDateKST(d: Date): string {
  return d.toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}
