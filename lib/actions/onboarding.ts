"use server";

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

const CONSENT_VERSION = "2026-05-19-v1";

/**
 * IA §7.1 단계 5 — 3그룹 동의 (서비스 / 민감정보 = 필수, 통계 / 마케팅 = 선택).
 *
 * 가입 폼에서 묵시 동의했지만 여기서 명시 동의 record 를 영구 저장.
 * 멱등: 기존 Consent 전부 삭제 후 재기록.
 */
export async function submitOnboardingConsents(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/signin");
  const userId = session.user.id;

  const service = formData.get("service") === "on";
  const sensitive = formData.get("sensitive") === "on";
  const statistics = formData.get("statistics") === "on";
  const marketing = formData.get("marketing") === "on";

  if (!service || !sensitive) {
    throw new Error("필수 동의가 누락되었습니다.");
  }

  const data: Array<{
    userId: string;
    type: "SERVICE" | "SENSITIVE_DATA" | "STATISTICS" | "MARKETING";
    version: string;
  }> = [
    { userId, type: "SERVICE", version: CONSENT_VERSION },
    { userId, type: "SENSITIVE_DATA", version: CONSENT_VERSION },
  ];
  if (statistics) data.push({ userId, type: "STATISTICS", version: CONSENT_VERSION });
  if (marketing) data.push({ userId, type: "MARKETING", version: CONSENT_VERSION });

  await prisma.$transaction([
    prisma.consent.deleteMany({ where: { userId } }),
    prisma.consent.createMany({ data }),
  ]);

  redirect("/app/onboarding/nickname");
}

const nicknameSchema = z.object({
  nickname: z
    .string()
    .trim()
    .min(2, "2자 이상 입력해 주세요.")
    .max(20, "최대 20자입니다.")
    .regex(/^[가-힣A-Za-z0-9 _-]+$/, "한글·영문·숫자·공백·_·- 만 사용 가능합니다."),
});

/**
 * IA §7.1 단계 6 — 익명 닉네임 설정. 실명 입력 없음.
 *
 * 같은 회사 내 nickname 중복 허용 (IA 명세 없음, 우리 결정: V1 허용).
 */
export async function submitNickname(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/signin");

  // Client 측 HTML pattern + minLength/maxLength 가 1차 검증.
  // 그래도 실패하면 throw — Next 에러 페이지로. UI 자체 에러 표시는 useActionState 도입(Day 9~) 후 보강.
  const parsed = nicknameSchema.safeParse({ nickname: formData.get("nickname") });
  if (!parsed.success) {
    throw new Error(`닉네임 형식 오류: ${parsed.error.issues[0].message}`);
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { nickname: parsed.data.nickname },
  });

  redirect("/app/onboarding/intro");
}
