import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { submitNickname } from "@/lib/actions/onboarding";

export default function OnboardingNicknamePage() {
  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl text-brand-700">익명 닉네임 (6/7)</CardTitle>
        <CardDescription>
          상담사·다른 직원·HR 누구에게도 실명은 노출되지 않습니다. 닉네임만 표시됩니다.
        </CardDescription>
      </CardHeader>
      <form action={submitNickname}>
        <CardContent className="space-y-3">
          <label htmlFor="nickname" className="text-sm font-medium">
            닉네임
          </label>
          <input
            id="nickname"
            name="nickname"
            type="text"
            required
            minLength={2}
            maxLength={20}
            pattern="[가-힣A-Za-z0-9 _\-]+"
            autoComplete="off"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
          <p className="text-xs text-muted-foreground">
            2~20자. 한글·영문·숫자·공백·_·- 사용 가능. 실명·전화번호 등 개인 식별 가능한 표현은 피해 주세요.
          </p>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full">
            다음으로 (7/7 → 자가진단 안내)
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
