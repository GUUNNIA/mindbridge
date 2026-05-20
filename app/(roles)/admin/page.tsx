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

        <Card>
          <CardHeader>
            <CardTitle>감사 로그</CardTitle>
            <CardDescription>권한 위반·민감 접근</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            withAuth 데코레이터가 이미 PERMISSION_DENIED 를 자동 기록 중입니다.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
