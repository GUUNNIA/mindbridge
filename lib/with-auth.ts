import { getServerSession } from "next-auth";
import type { UserRole } from "@prisma/client";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  defineAbilityFor,
  type AbilityUser,
  type AppAbility,
  type AppAction,
  type AppSubject,
} from "@/lib/abilities";

/**
 * Server Action 권한 데코레이터 (PRD §6.1).
 *
 * 사용:
 *   export const searchAuditLogs = withAuth(
 *     { action: "read", subject: "AuditLog" },
 *     async (ctx, filter) => { ... },
 *   );
 *
 * 동작:
 *   1) getServerSession → 비로그인이면 ForbiddenError("Not authenticated")
 *   2) defineAbilityFor(user).can(action, subject) → 거부 시 AuditLog
 *      PERMISSION_DENIED 1건 기록 후 ForbiddenError
 *   3) 통과 → 원 함수에 AuthContext 주입
 */

export class ForbiddenError extends Error {
  readonly code = "FORBIDDEN";
  constructor(message = "Permission denied") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class UnauthenticatedError extends ForbiddenError {
  constructor() {
    super("Not authenticated");
    this.name = "UnauthenticatedError";
  }
}

export interface AuthContext {
  user: {
    id: string;
    email: string;
    role: UserRole;
    anonymizedId: string;
  };
  ability: AppAbility;
}

export interface Policy {
  action: AppAction;
  subject: AppSubject;
  resourceId?: string;
}

async function recordPermissionDenied(
  actorId: string | null,
  policy: Policy,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId,
      action: "PERMISSION_DENIED",
      resourceType: policy.subject,
      resourceId: policy.resourceId ?? "n/a",
      metadata: { policy: { action: policy.action, subject: policy.subject }, ...metadata },
    },
  });
}

/**
 * 순수 권한 강제 헬퍼 — 테스트·서버 액션 양쪽에서 재사용.
 * 거부 시 AuditLog 1건 기록 후 ForbiddenError throw.
 */
export async function enforce(
  user: AbilityUser & { email: string; anonymizedId: string },
  policy: Policy,
  metadata?: Record<string, unknown>,
): Promise<AuthContext> {
  const ability = defineAbilityFor(user);
  if (!ability.can(policy.action, policy.subject)) {
    await recordPermissionDenied(user.id, policy, metadata);
    throw new ForbiddenError(`Cannot ${policy.action} ${policy.subject}`);
  }
  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      anonymizedId: user.anonymizedId,
    },
    ability,
  };
}

/** Server Action wrapper. */
export function withAuth<TArgs extends unknown[], TResult>(
  policy: Policy,
  fn: (ctx: AuthContext, ...args: TArgs) => Promise<TResult>,
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      throw new UnauthenticatedError();
    }
    const ctx = await enforce(
      {
        id: session.user.id,
        role: session.user.role,
        email: session.user.email,
        anonymizedId: session.user.anonymizedId,
      },
      policy,
    );
    return fn(ctx, ...args);
  };
}
