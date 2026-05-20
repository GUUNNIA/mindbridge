import type { UserRole } from "@prisma/client";

/**
 * 롤별 홈 경로 매핑.
 * client/server 양쪽에서 안전하게 import 가능하도록 prisma 의존성 없이 분리.
 */
export const ROLE_HOME: Record<UserRole, string> = {
  EMPLOYEE: "/app",
  COUNSELOR: "/counselor",
  PSYCHIATRIST: "/psychiatrist",
  HR: "/hr",
  ADMIN: "/admin",
};
