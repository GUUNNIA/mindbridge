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
import { devVerifyEmail } from "@/lib/actions/signup";

export const metadata = {
  title: "이메일 인증 | MindBridge",
};

export default async function VerifyPendingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/signin");

  async function verifyAction() {
    "use server";
    const s = await getServerSession(authOptions);
    if (!s?.user) redirect("/signin");
    await devVerifyEmail(s.user.id);
    redirect("/app/onboarding/consents");
  }

  return (
    <main className="min-h-screen bg-muted/40 flex items-center justify-center px-6 py-16">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-brand-700">이메일 인증 (3/7)</CardTitle>
          <CardDescription>
            <span className="font-medium text-foreground">{session.user.email}</span>로 인증 메일을
            보냈습니다. 메일의 링크를 클릭해 주세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>이 단계는 Week 2 Day 12 (Resend 도입) 이후 실제 메일 발송으로 대체됩니다.</p>
          <p>지금은 dev 모드 — 아래 버튼으로 자동 인증 후 다음 단계로 진행하세요.</p>
        </CardContent>
        <CardFooter>
          <form action={verifyAction} className="w-full">
            <Button type="submit" className="w-full">
              [dev] 자동 인증 후 계속 (4/7 → 동의)
            </Button>
          </form>
        </CardFooter>
      </Card>
    </main>
  );
}
