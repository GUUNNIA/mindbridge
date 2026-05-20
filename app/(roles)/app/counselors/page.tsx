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
import { listRecommendedCounselors } from "@/lib/actions/match";

const TIER_LABEL: Record<string, string> = {
  JUNIOR: "주니어",
  SENIOR: "시니어",
  SUPERVISOR: "수퍼바이저",
};

export default async function CounselorsPage({
  searchParams,
}: {
  searchParams: Promise<{ assessmentId?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "EMPLOYEE") redirect("/403");
  await guardOnboarded(session.user.id);

  const { assessmentId: queryId } = await searchParams;

  // assessmentId 없으면 최신 completed assessment 자동 선택
  let assessmentId = queryId;
  if (!assessmentId) {
    const latest = await prisma.assessment.findFirst({
      where: { userId: session.user.id, status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
      select: { id: true },
    });
    assessmentId = latest?.id;
  }

  if (!assessmentId) {
    return (
      <Card className="mx-auto w-full max-w-xl">
        <CardHeader>
          <CardTitle>상담사 추천</CardTitle>
          <CardDescription>먼저 자가진단을 완료해 주세요.</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild className="w-full">
            <Link href="/app/assessment">자가진단 시작</Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  const recs = await listRecommendedCounselors({ assessmentId });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">추천 상담사</h1>
        <p className="text-sm text-muted-foreground">
          자가진단 결과를 바탕으로 BR-4 가중치(카테고리·평점·가용·다양성·신규)로 정렬된 상위 3명입니다.
        </p>
      </header>

      {recs.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>추천 가능한 상담사가 없습니다</CardTitle>
            <CardDescription>
              승인된 상담사가 풀에 없거나 자격·가용 조건을 충족하지 못합니다. 운영자에게 문의해 주세요.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {recs.map((r, idx) => (
            <Card key={r.counselorId} className="flex flex-col">
              <CardHeader>
                <div className="flex items-baseline justify-between">
                  <CardTitle className="text-lg">{r.nickname}</CardTitle>
                  <span className="text-xs text-muted-foreground">#{idx + 1}</span>
                </div>
                <CardDescription>
                  {TIER_LABEL[r.tier] ?? r.tier} · {r.yearsOfPractice}년차
                  {r.rating != null && ` · ★ ${r.rating.toFixed(1)}`}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 space-y-2 text-sm">
                {r.bio && <p className="text-foreground">{r.bio}</p>}
                <p className="text-xs text-muted-foreground">추천 이유: {r.reasonText}</p>
                <p className="text-xs text-muted-foreground">
                  매칭 점수: {r.totalScore.toFixed(1)} / 100
                </p>
              </CardContent>
              <CardFooter>
                <Button asChild className="w-full">
                  <Link href={`/app/counselors/${r.counselorId}`}>슬롯 보기</Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
