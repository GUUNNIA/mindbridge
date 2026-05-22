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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>초대코드</CardTitle>
            <CardDescription>직원 가입용 1회 코드 발급·폐기</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 text-sm text-muted-foreground">
            Day 13 기능 활성. 발급 후 30일 유효.
          </CardContent>
          <CardFooter>
            <Button asChild className="w-full">
              <Link href="/hr/invites">발급 페이지로</Link>
            </Button>
          </CardFooter>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>대시보드</CardTitle>
            <CardDescription>이번 달 익명 집계 · k≥5 마스킹</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 text-sm text-muted-foreground">
            이용률·카테고리·번아웃·부서별 지표. Day 22 텍스트 카드 → Day 23 차트화.
          </CardContent>
          <CardFooter>
            <Button asChild className="w-full">
              <Link href="/hr/dashboard">대시보드 열기</Link>
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>카테고리 분포</CardTitle>
            <CardDescription>상담 주제 익명 집계</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Claude classify_category 결과가 익명 집계됩니다. 대시보드에서 확인.
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
