"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/with-auth";

/**
 * InviteCode 발급·조회·폐기 (PRD §6.1.1, Day 13).
 *
 * - createInviteCode: HR 이 발급. 형식 `INV-XXXXXXXX` (UUID 8자 uppercase).
 *   회사 단위 unique 제약은 회사가 1개라 의미 적음 — Code 자체가 unique.
 * - listInvites: HR 회사 발급 코드 목록 (최근 50건).
 * - revokeInviteCode: HR 본인 회사 코드만 revoke. usedAt 있으면 무효.
 *
 * 권한:
 *   - HR: can(["create", "read", "update"], "InviteCode") — Day 13 추가
 *   - ADMIN: manage:all 로 통과
 *
 * 회사 격리: 발급·조회·폐기 모두 user.companyId 로 자동 필터링.
 */

const DEFAULT_EXPIRES_DAYS = 30;
const MAX_EXPIRES_DAYS = 90;

const createSchema = z.object({
  email: z
    .string()
    .trim()
    .email("이메일 형식이 올바르지 않습니다.")
    .max(254)
    .transform((v) => v.toLowerCase())
    .optional()
    .or(z.literal("").transform(() => undefined)),
  expiresInDays: z
    .number()
    .int()
    .min(1)
    .max(MAX_EXPIRES_DAYS)
    .optional(),
});

export type CreateInviteInput = z.infer<typeof createSchema>;
export type CreateInviteResult =
  | { ok: true; code: string; id: string }
  | { ok: false; error: string };

function generateCode(): string {
  return `INV-${randomUUID().slice(0, 8).toUpperCase()}`;
}

export const createInviteCode = withAuth(
  { action: "create", subject: "InviteCode" },
  async (ctx, input: CreateInviteInput = {}): Promise<CreateInviteResult> => {
    const parsed = createSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0].message };
    }
    if (!ctx.user.companyId) {
      return { ok: false, error: "회사 정보가 없는 HR 계정입니다." };
    }

    const days = parsed.data.expiresInDays ?? DEFAULT_EXPIRES_DAYS;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    // code unique 충돌은 사실상 일어나지 않지만 (UUID 8자 hex), 안전망으로 1회 재시도
    for (let attempt = 0; attempt < 2; attempt++) {
      const code = generateCode();
      try {
        const created = await prisma.inviteCode.create({
          data: {
            code,
            companyId: ctx.user.companyId,
            issuedById: ctx.user.id,
            email: parsed.data.email,
            expiresAt,
          },
          select: { id: true, code: true },
        });
        return { ok: true, code: created.code, id: created.id };
      } catch (e) {
        // P2002 (unique 위반) 시 한 번 재시도
        if (attempt === 0 && isUniqueViolation(e)) continue;
        throw e;
      }
    }
    return { ok: false, error: "초대코드 생성 중 충돌이 반복됐습니다." };
  },
);

export interface InviteRow {
  id: string;
  code: string;
  email: string | null;
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

export const listInvites = withAuth(
  { action: "read", subject: "InviteCode" },
  async (ctx, input: { take?: number } = {}): Promise<InviteRow[]> => {
    if (!ctx.user.companyId) return [];
    const take = Math.min(Math.max(input.take ?? 50, 1), 200);
    const rows = await prisma.inviteCode.findMany({
      where: { companyId: ctx.user.companyId },
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        code: true,
        email: true,
        expiresAt: true,
        usedAt: true,
        revokedAt: true,
        createdAt: true,
      },
    });
    return rows;
  },
);

export const revokeInviteCode = withAuth(
  { action: "update", subject: "InviteCode" },
  async (
    ctx,
    input: { id: string },
  ): Promise<{ ok: true } | { ok: false; error: string }> => {
    if (!ctx.user.companyId) {
      return { ok: false, error: "회사 정보가 없는 HR 계정입니다." };
    }
    const invite = await prisma.inviteCode.findUnique({
      where: { id: input.id },
      select: { companyId: true, usedAt: true, revokedAt: true },
    });
    if (!invite) return { ok: false, error: "초대코드를 찾을 수 없습니다." };
    if (invite.companyId !== ctx.user.companyId) {
      await prisma.auditLog.create({
        data: {
          actorId: ctx.user.id,
          action: "PERMISSION_DENIED",
          resourceType: "InviteCode",
          resourceId: input.id,
          metadata: { reason: "cross-company revoke", at: "revokeInviteCode" },
        },
      });
      return { ok: false, error: "권한이 없습니다." };
    }
    if (invite.usedAt) {
      return { ok: false, error: "이미 사용된 코드는 폐기할 수 없습니다." };
    }
    if (invite.revokedAt) {
      return { ok: false, error: "이미 폐기된 코드입니다." };
    }
    await prisma.inviteCode.update({
      where: { id: input.id },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  },
);

function isUniqueViolation(e: unknown): boolean {
  if (e instanceof Error && "code" in e) {
    return (e as { code?: string }).code === "P2002";
  }
  return false;
}
