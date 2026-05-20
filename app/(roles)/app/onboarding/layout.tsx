import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";

/**
 * IA §7.1 onboarding 공통 셸 — 진행 표시는 각 페이지가 직접 (5/7 ~ 7/7) 노출.
 * EMPLOYEE 전용 가드. role 불일치는 /403.
 */
export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/signin");
  if (session.user.role !== "EMPLOYEE") redirect("/403");

  return <div className="space-y-6">{children}</div>;
}
