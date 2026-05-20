import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { submitOnboardingConsents } from "@/lib/actions/onboarding";

export default function OnboardingConsentsPage() {
  return (
    <Card className="mx-auto w-full max-w-xl">
      <CardHeader>
        <CardTitle className="text-2xl text-brand-700">동의 (5/7)</CardTitle>
        <CardDescription>
          서비스 이용·민감정보 처리는 필수 동의입니다. 통계·마케팅은 선택입니다.
        </CardDescription>
      </CardHeader>
      <form action={submitOnboardingConsents}>
        <CardContent className="space-y-4">
          <ConsentItem
            name="service"
            label="[필수] 서비스 이용약관 동의"
            description="회원가입·서비스 운영을 위한 기본 약관"
            required
          />
          <ConsentItem
            name="sensitive"
            label="[필수] 민감정보 처리 동의"
            description="자가진단·세션 내용 등 정신건강 관련 민감정보 처리 (V1 keyVersion=1 컬럼 암호화 예정)"
            required
          />
          <ConsentItem
            name="statistics"
            label="[선택] 익명 통계 활용 동의"
            description="HR 익명 집계 모집단 포함 (미동의 시 BR-12 — HR 통계에서 제외)"
          />
          <ConsentItem
            name="marketing"
            label="[선택] 마케팅 정보 수신 동의"
            description="제품 업데이트·웹세미나 안내 메일 수신"
          />
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full">
            다음으로 (6/7 → 닉네임)
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function ConsentItem({
  name,
  label,
  description,
  required,
}: {
  name: string;
  label: string;
  description: string;
  required?: boolean;
}) {
  return (
    <label className="flex items-start gap-3 rounded-md border border-border p-3 cursor-pointer hover:bg-muted/40">
      <input
        type="checkbox"
        name={name}
        required={required}
        className="mt-0.5 size-4 rounded border-input"
      />
      <span className="space-y-1">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}
