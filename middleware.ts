import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * 미들웨어 1차 권한 검증.
 * - prefix → 요구 롤 매핑 (PRD §2.1, IA §3)
 * - 실제 NextAuth 통합은 Week 1 Day 2 이후. 현재는 스켈레톤만.
 * - 자원 단위 권한(예: 다른 상담사 노트 접근)은 CASL ability로 Server Action 레벨에서 검증.
 */

const ROLE_PREFIXES: Record<string, string> = {
  "/app": "EMPLOYEE",
  "/counselor": "COUNSELOR",
  "/psychiatrist": "PSYCHIATRIST",
  "/hr": "HR",
  "/admin": "ADMIN",
};

// /app/emergency는 위기 핫라인이라 로그인 없이도 접근 가능 (PRD §3.2.1 US-E4)
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
  "/app/emergency",
]);

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const requiredRole = Object.entries(ROLE_PREFIXES).find(([prefix]) =>
    pathname.startsWith(prefix),
  )?.[1];

  if (!requiredRole) {
    return NextResponse.next();
  }

  // TODO Week 1 Day 2: NextAuth 세션에서 토큰 추출 → 롤 확인
  // 현재는 모든 보호 경로를 /signin으로 리다이렉트
  const signInUrl = new URL("/signin", req.url);
  signInUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(signInUrl);
}

export const config = {
  matcher: [
    /*
     * 다음을 제외한 모든 경로:
     * - api (API routes는 Server Actions로 대체)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, robots.txt, sitemap.xml
     */
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
