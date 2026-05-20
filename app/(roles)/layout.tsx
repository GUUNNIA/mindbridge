import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { SignOutButton } from "@/components/sign-out-button";
import { authOptions } from "@/lib/auth";
import { ROLE_HOME } from "@/lib/role-routes";

const ROLE_LABEL: Record<string, string> = {
  EMPLOYEE: "직원",
  COUNSELOR: "상담사",
  PSYCHIATRIST: "전문의",
  HR: "HR",
  ADMIN: "운영자",
};

export default async function RolesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    // 미들웨어가 이미 차단하지만 깊은 방어 — 직접 접근 또는 세션 만료 대응
    redirect("/signin");
  }

  const { role, email, name } = session.user;
  const home = ROLE_HOME[role];
  const label = ROLE_LABEL[role] ?? role;

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href={home} className="text-lg font-semibold text-brand-700">
            MindBridge
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted-foreground">
              <span className="rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                {label}
              </span>{" "}
              <span className="font-medium text-foreground">
                {name ?? email}
              </span>
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
