import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";

/**
 * 직원 onboarding 단계 판정.
 *
 * 필수 조건:
 *   - SERVICE + SENSITIVE_DATA Consent 가 revoke 안 된 채로 존재
 *   - User.nickname 채워짐
 *
 * intro 단계는 권유 화면이라 가드에서 강제하지 않음 — 사용자가 안 봐도 /app 진입 가능.
 */
export type OnboardingStep = "consents" | "nickname" | "done";

export async function getRequiredStep(userId: string): Promise<OnboardingStep> {
  const [consents, user] = await Promise.all([
    prisma.consent.findMany({
      where: { userId, revokedAt: null },
      select: { type: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { nickname: true },
    }),
  ]);
  const types = new Set(consents.map((c) => c.type));
  if (!types.has("SERVICE") || !types.has("SENSITIVE_DATA")) return "consents";
  if (!user?.nickname) return "nickname";
  return "done";
}

export const ONBOARDING_REDIRECT: Record<Exclude<OnboardingStep, "done">, string> = {
  consents: "/app/onboarding/consents",
  nickname: "/app/onboarding/nickname",
};

/**
 * EMPLOYEE 페이지(except /app/onboarding/*, /app/emergency)에서 시작 부분에 호출.
 * onboarding 미완 시 해당 단계로 redirect.
 */
export async function guardOnboarded(userId: string): Promise<void> {
  const step = await getRequiredStep(userId);
  if (step !== "done") {
    redirect(ONBOARDING_REDIRECT[step]);
  }
}
