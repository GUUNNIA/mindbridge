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
import { prisma } from "@/lib/db";

const SEVERITY_LABEL: Record<string, { label: string; color: string }> = {
  NONE: { label: "해당 없음", color: "bg-muted text-muted-foreground" },
  MILD: { label: "경미", color: "bg-brand-100 text-brand-700" },
  MODERATE: { label: "중간", color: "bg-risk-l1 text-foreground" },
  MODERATELY_SEVERE: { label: "다소 심각", color: "bg-risk-l2 text-white" },
  SEVERE: { label: "심각", color: "bg-risk-l3 text-white" },
};

export default async function AssessmentResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "EMPLOYEE") redirect("/403");
  const { id } = await params;

  const assessment = await prisma.assessment.findUnique({
    where: { id },
    include: { primaryCategory: true },
  });
  if (!assessment || assessment.userId !== session.user.id) notFound();
  if (assessment.status !== "COMPLETED") {
    redirect(`/app/assessment/${id}`);
  }

  const sev = assessment.severity ? SEVERITY_LABEL[assessment.severity] : null;

  const secondaryCats =
    assessment.secondaryCategoryIds.length > 0
      ? await prisma.category.findMany({
          where: { slug: { in: assessment.secondaryCategoryIds } },
          select: { name: true, slug: true },
        })
      : [];

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl text-brand-700">자가진단 결과</CardTitle>
          <CardDescription>
            완료일: {assessment.completedAt?.toLocaleString("ko-KR")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">주요 카테고리</p>
            <p className="text-xl font-semibold text-foreground">
              {assessment.primaryCategory?.name ?? "분류되지 않음"}
            </p>
            {secondaryCats.length > 0 && (
              <p className="mt-1 text-sm text-muted-foreground">
                관련: {secondaryCats.map((c) => c.name).join(", ")}
              </p>
            )}
          </div>
          {sev && (
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">심각도</p>
              <span className={`mt-1 inline-block rounded-md px-2.5 py-1 text-sm font-medium ${sev.color}`}>
                {sev.label}
              </span>
            </div>
          )}
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">요약</p>
            <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">
              {assessment.summaryForEmployee}
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button asChild variant="outline" className="flex-1">
            <Link href="/app">홈으로</Link>
          </Button>
          <Button disabled className="flex-1">
            상담사 찾기 (Day 10 활성화)
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">참고</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-1">
          <p>본 결과는 챗봇 대화 기반 추정이며 임상 진단을 대체하지 않습니다.</p>
          <p>심각도 SEVERE 가 표시된 경우 즉시 위기 핫라인(국번없이 1393, 자살예방상담전화) 또는 상담사 연결을 고려해 주세요.</p>
        </CardContent>
      </Card>
    </div>
  );
}
