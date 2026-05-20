import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function OnboardingIntroPage() {
  return (
    <Card className="mx-auto w-full max-w-xl">
      <CardHeader>
        <CardTitle className="text-2xl text-brand-700">자가진단 안내 (7/7)</CardTitle>
        <CardDescription>
          가입이 완료됐습니다. 자가진단으로 시작하시거나 나중에 홈에서 시작할 수 있어요.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <p>
          자가진단은 챗봇과 4~6턴 대화 후 카테고리·심각도 결과를 안내합니다. 결과에 따라 적합한 상담사 3명을
          추천해 드립니다.
        </p>
        <p>
          내용은 익명으로 처리되며, 회사 HR은 개인 식별이 불가능한 통계만 봅니다 (BR-12).
        </p>
        <p className="text-xs">
          자가진단 챗봇 자체는 Week 2 Day 9에 활성화됩니다. 지금은 안내 화면입니다.
        </p>
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button asChild variant="outline" className="flex-1">
          <Link href="/app">나중에 (홈으로)</Link>
        </Button>
        <Button disabled className="flex-1">
          지금 시작 (Day 9 활성화 예정)
        </Button>
      </CardFooter>
    </Card>
  );
}
