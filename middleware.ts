import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import type { UserRole } from "@prisma/client";

/**
 * 미들웨어 1차 권한 검증.
 * - prefix → 요구 롤 매핑 (PRD §2.1, IA §3)
 * - 자원 단위 권한(예: 다른 상담사 노트 접근)은 CASL ability로 Server Action 레벨에서 검증.
 *
 * 동작:
 *   1. PUBLIC_PATHS → 통과
 *   2. 보호 prefix 매칭 → 토큰 확인
 *      - 토큰 없음 → /signin?from=...
 *      - 토큰 있음 + 롤 불일치 → /403
 *      - 일치 → 통과
 */

const ROLE_PREFIXES: Record<string, UserRole> = {
  "/app": "EMPLOYEE",
  "/counselor": "COUNSELOR",
  "/psychiatrist": "PSYCHIATRIST",
  "/hr": "HR",
  "/admin": "ADMIN",
};

// /app/emergency 는 위기 핫라인이라 로그인 없이도 접근 가능 (PRD §3.2.1 US-E4)
const PUBLIC_PATHS = new Set([
  "/",
  "/signin",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/terms",
  "/privacy",
  "/policy/refund",
  "/faq",
  "/contact",
  "/maintenance",
  "/403",
  "/app/emergency",
]);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const matched = Object.entries(ROLE_PREFIXES).find(([prefix]) =>
    pathname.startsWith(prefix),
  );

  if (!matched) {
    return NextResponse.next();
  }

  const [, requiredRole] = matched;

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    const signInUrl = new URL("/signin", req.url);
    signInUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(signInUrl);
  }

  if (token.role !== requiredRole) {
    return NextResponse.redirect(new URL("/403", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * 다음을 제외한 모든 경로:
     * - api (NextAuth API 포함 — 미들웨어 통과 필요 없음)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, robots.txt, sitemap.xml
     */
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
