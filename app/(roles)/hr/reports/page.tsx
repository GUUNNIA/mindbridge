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
import { generateInsightPreview } from "@/lib/actions/hr";
import { lastNMonthsUtc } from "@/lib/hr/period";

/**
 * /hr/reports — HR 월간 리포트 발행 (Day 24).
 *
 * V1: 발행 이력은 저장하지 않고 매번 on-demand 생성.
 *     기본 기간 = 최근 6개월. 미리보기는 server-side, PDF 는 route handler 가 즉시 응답.
 *
 * BR-7 미달 시 미리보기 차단 + 안내.
 */
export default async function HRReportsPage() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "HR" && session?.user.role !== "ADMIN") {
    redirect("/403");
  }

  const period = lastNMonthsUtc(6);
  const preview = await generateInsightPreview(period);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">월간 리포트</h1>
        <p className="text-sm text-muted-foreground">
          최근 6개월 익명 집계 기반 임원 보고용 리포트. k≥5 마스킹과 STATISTICS 동의자 모집단 가드를 통과한 데이터만 사용합니다.
        </p>
      </header>

      {!preview.ok ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-amber-900">발행 차단 (BR-7)</CardTitle>
            <CardDescription className="text-amber-800">
              {preview.error}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">미리보기 — 핵심 인사이트</CardTitle>
              <CardDescription>
                실제 PDF 와 동일한 텍스트입니다. 생성은 결정적 mock (ANTHROPIC_API_KEY 등록 시 Claude 호출로 자동 전환).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p className="leading-relaxed">{preview.insight.insightParagraph}</p>

              <div>
                <h3 className="mb-2 text-sm font-medium">Key Takeaways</h3>
                <ol className="ml-4 list-decimal space-y-1 text-muted-foreground">
                  {preview.insight.keyTakeaways.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ol>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-medium">Recommended Actions</h3>
                <ol className="ml-4 list-decimal space-y-1 text-muted-foreground">
                  {preview.insight.recommendedActions.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ol>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">PDF 다운로드</CardTitle>
              <CardDescription>
                위 인사이트 + 카테고리·심각도·부서별 표가 포함된 1페이지 PDF.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button asChild className="sm:w-auto">
                <a
                  href={`/api/hr/report/pdf?startISO=${encodeURIComponent(period.startISO)}&endISO=${encodeURIComponent(period.endISO)}`}
                >
                  PDF 다운로드
                </a>
              </Button>
              <p className="text-xs text-muted-foreground">
                다운로드 시점에 AuditLog 에 기록됩니다.
              </p>
            </CardContent>
          </Card>
        </>
      )}

      <div>
        <Button asChild variant="outline">
          <Link href="/hr">HR 홈으로</Link>
        </Button>
      </div>
    </div>
  );
}
