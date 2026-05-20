import Link from "next/link";
import { redirect } from "next/navigation";
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
import { guardOnboarded } from "@/lib/onboarding";

export default async function EmployeeHome() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "EMPLOYEE") redirect("/403");
  await guardOnboarded(session.user.id);

  const [latestAssessment, inProgress] = await Promise.all([
    prisma.assessment.findFirst({
      where: { userId: session.user.id, status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
      select: { id: true, completedAt: true, primaryCategory: { select: { name: true } } },
    }),
    prisma.assessment.findFirst({
      where: { userId: session.user.id, status: "IN_PROGRESS" },
      orderBy: { startedAt: "desc" },
      select: { id: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">직원 홈</h1>
        <p className="text-sm text-muted-foreground">
          {session.user.name ?? session.user.email} 님, 환영합니다.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>자가진단</CardTitle>
            <CardDescription>
              {inProgress
                ? "진행 중인 자가진단이 있습니다."
                : latestAssessment
                  ? `최근: ${latestAssessment.primaryCategory?.name ?? "분류 없음"} (${latestAssessment.completedAt?.toLocaleDateString("ko-KR")})`
                  : "주 1회 권장"}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            챗봇과 4~6턴 대화 후 카테고리·심각도가 안내됩니다.
          </CardContent>
          <CardFooter className="gap-2">
            <Button asChild className="flex-1">
              <Link href="/app/assessment">
                {inProgress ? "이어서 진행" : "시작하기"}
              </Link>
            </Button>
            {latestAssessment && (
              <Button asChild variant="outline" className="flex-1">
                <Link href={`/app/assessment/${latestAssessment.id}/result`}>최근 결과</Link>
              </Button>
            )}
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>예약된 상담</CardTitle>
            <CardDescription>다가오는 세션</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Week 2 Day 11에 예약 흐름이 활성화됩니다.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
