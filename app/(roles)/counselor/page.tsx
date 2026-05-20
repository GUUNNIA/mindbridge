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

export default async function CounselorHome() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "COUNSELOR") redirect("/403");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">상담사 홈</h1>
        <p className="text-sm text-muted-foreground">
          {session.user.name ?? session.user.email} 님, 오늘 일정입니다.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>오늘 일정</CardTitle>
            <CardDescription>세션·미팅</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Week 3 Day 14~15에 세션룸·일정 카드가 들어옵니다.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>케이스 큐</CardTitle>
            <CardDescription>담당 케이스</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Week 3 Day 16~17에 SOAP 노트 작성 도구가 활성화됩니다.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
