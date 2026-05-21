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
import { listCounselorCases } from "@/lib/actions/counselor-cases";

export default async function CounselorHome() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "COUNSELOR") redirect("/403");

  const cases = await listCounselorCases();
  const upcoming = cases.filter(
    (c) =>
      c.status !== "CANCELED_BY_USER" &&
      c.status !== "CANCELED_BY_COUNSELOR" &&
      c.status !== "COMPLETED" &&
      c.status !== "NO_SHOW",
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">상담사 홈</h1>
        <p className="text-sm text-muted-foreground">
          {session.user.name ?? session.user.email} 님, 오늘 일정입니다.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>케이스 큐</CardTitle>
            <CardDescription>담당 케이스 (활성 {upcoming.length}건)</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 text-sm text-muted-foreground">
            {upcoming.length === 0
              ? "활성 케이스가 없습니다."
              : "직원 진단 요약과 이전 노트는 케이스 상세에서 확인하세요."}
          </CardContent>
          <CardFooter>
            <Button asChild className="w-full">
              <Link href="/counselor/cases">케이스 목록</Link>
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>SOAP 노트</CardTitle>
            <CardDescription>임상 노트 작성 도구</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Week 3 Day 17 에 generate_soap tool + 노트 편집기가 활성화됩니다.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
