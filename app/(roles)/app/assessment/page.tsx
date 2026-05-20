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
import { startAssessmentAndRedirect } from "@/lib/actions/assessment";
import { prisma } from "@/lib/db";
import { guardOnboarded } from "@/lib/onboarding";
import { provider } from "@/lib/ai/client";

export default async function AssessmentEntryPage() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "EMPLOYEE") redirect("/403");
  await guardOnboarded(session.user.id);

  const inProgress = await prisma.assessment.findFirst({
    where: { userId: session.user.id, status: "IN_PROGRESS" },
    select: { id: true, startedAt: true },
    orderBy: { startedAt: "desc" },
  });

  return (
    <Card className="mx-auto w-full max-w-xl">
      <CardHeader>
        <CardTitle className="text-2xl text-brand-700">자가진단 챗봇</CardTitle>
        <CardDescription>
          챗봇과 4~6턴 대화 후 카테고리·심각도를 안내해 드립니다. 모든 내용은 익명 처리됩니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        {inProgress ? (
          <p>
            이전에 시작한 자가진단이 있습니다 (
            {inProgress.startedAt.toLocaleDateString("ko-KR")} 시작).
          </p>
        ) : (
          <p>새 자가진단을 시작합니다.</p>
        )}
        <p className="text-xs">
          {provider === "mock"
            ? "Day 9 mock 모드: Anthropic API key 미등록이라 키워드 기반 결정적 mock 으로 분류됩니다."
            : "Claude 실시간 분류 모드."}
        </p>
      </CardContent>
      <CardFooter>
        <form action={startAssessmentAndRedirect} className="w-full">
          <Button type="submit" className="w-full">
            {inProgress ? "이어서 진행" : "시작하기"}
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
