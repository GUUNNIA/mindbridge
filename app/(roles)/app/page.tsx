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

export default async function EmployeeHome() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "EMPLOYEE") redirect("/403");

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
            <CardTitle>오늘의 자가진단</CardTitle>
            <CardDescription>주 1회 권장</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Week 2 Day 7에 PHQ-9 / GAD-7 챗봇이 들어옵니다.
          </CardContent>
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
