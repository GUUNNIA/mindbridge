"use client";

import { Suspense, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { signUpWithInvite } from "@/lib/actions/signup";

type FieldErr = "code" | "email" | "password" | null;

function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [code, setCode] = useState(searchParams.get("code") ?? "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<FieldErr>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErr(null);

    startTransition(async () => {
      const result = await signUpWithInvite({ code: code.trim().toUpperCase(), email, password });
      if (!result.ok) {
        setError(result.error);
        if (result.field) setFieldErr(result.field);
        return;
      }

      const signedIn = await signIn("credentials", {
        email: result.email,
        password,
        redirect: false,
      });
      if (!signedIn || signedIn.error) {
        // 가입은 됐지만 자동 로그인 실패 — /signin 으로 안내
        router.replace(`/signin?from=/signup/verify-pending`);
        return;
      }
      router.replace("/signup/verify-pending");
      router.refresh();
    });
  }

  return (
    <main className="min-h-screen bg-muted/40 flex items-center justify-center px-6 py-16">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-brand-700">가입 (1/7)</CardTitle>
          <CardDescription>초대코드와 이메일·비밀번호를 입력해 주세요.</CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit}>
          <CardContent className="space-y-4">
            <Field
              id="code"
              label="초대코드"
              value={code}
              onChange={setCode}
              autoComplete="one-time-code"
              required
              invalid={fieldErr === "code"}
              hint="HR로부터 받은 초대코드 (예: INV-XXXXXXXX)"
            />
            <Field
              id="email"
              type="email"
              label="이메일"
              value={email}
              onChange={setEmail}
              autoComplete="email"
              required
              invalid={fieldErr === "email"}
            />
            <Field
              id="password"
              type="password"
              label="비밀번호"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              required
              minLength={10}
              invalid={fieldErr === "password"}
              hint="최소 10자"
            />
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              가입 시 서비스 이용약관과 개인정보처리방침에 동의하는 것으로 간주됩니다 (단계 5에서 명시적으로 다시 확인).
            </p>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "가입 처리 중…" : "다음으로"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}

function Field({
  id,
  type = "text",
  label,
  value,
  onChange,
  autoComplete,
  required,
  minLength,
  invalid,
  hint,
}: {
  id: string;
  type?: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  invalid?: boolean;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid || undefined}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20"
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpForm />
    </Suspense>
  );
}
