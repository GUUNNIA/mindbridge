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

export default async function AdminHome() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") redirect("/403");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">운영자 콘솔</h1>
        <p className="text-sm text-muted-foreground">
          {session.user.name ?? session.user.email} 님 · 위기·풀·정산·감사 로그.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>위기 알림 큐</CardTitle>
            <CardDescription>L2/L3/L4 즉시 대응</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Week 3 Day 19에 위기 감지·알림이 활성화됩니다.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>상담사 풀</CardTitle>
            <CardDescription>승인·자격 검증·정지</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Counselor 모델 + 자격증 인증 흐름은 Week 1 Day 5 시드에서 데이터 채워집니다.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>정산</CardTitle>
            <CardDescription>월간 페이아웃</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Week 4에 PayoutSummary 가 활성화됩니다.
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>감사 로그</CardTitle>
            <CardDescription>권한 위반·민감 접근·리포트 발행 추적</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 text-sm text-muted-foreground">
            actor·resourceType·action·기간 필터로 검색. withAuth 데코레이터의
            PERMISSION_DENIED + 각 server action 의 명시적 AuditLog 기록.
          </CardContent>
          <CardFooter>
            <Button asChild className="w-full">
              <Link href="/admin/audit-logs">감사 로그 열기</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
