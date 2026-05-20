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

export default async function HRHome() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "HR") redirect("/403");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">HR 대시보드</h1>
        <p className="text-sm text-muted-foreground">
          {session.user.name ?? session.user.email} 님 · 익명 집계만 표시됩니다 (k≥5).
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>이용률</CardTitle>
            <CardDescription>월간 활성 사용자</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Week 4 Day 22~23에 차트가 들어옵니다.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>카테고리 분포</CardTitle>
            <CardDescription>상담 주제 익명 집계</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Claude classify_category 결과가 익명 집계됩니다.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>월간 리포트</CardTitle>
            <CardDescription>임원 보고용 PDF</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Week 4 Day 24에 generate_hr_insight + PDF가 활성화됩니다.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
