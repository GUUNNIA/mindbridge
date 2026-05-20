import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { authOptions } from "@/lib/auth";

export default async function PsychiatristHome() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "PSYCHIATRIST") redirect("/403");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">전문의 홈</h1>
        <p className="text-sm text-muted-foreground">
          {session.user.name ?? session.user.email} 님, 에스컬레이션 큐를 확인하세요.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>에스컬레이션 큐</CardTitle>
            <CardDescription>위기 케이스 우선순위 정렬</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Week 3 Day 19~20에 위기 감지·사인오프 워크플로우가 들어옵니다.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>리뷰 대기</CardTitle>
            <CardDescription>임상 노트 검토</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            상담사 SOAP 노트 리뷰·약물 권고는 Week 3 후반에 활성화됩니다.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
