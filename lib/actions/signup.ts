"use server";

import { randomUUID } from "node:crypto";
import { hash } from "@node-rs/bcrypt";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { anonymizeIdFromEnv } from "@/lib/anon";

/**
 * 직원 가입 (PRD §6.1.1 signUpWithInvite, IA §7.1 Onboarding 단계 1~2).
 *
 * 동작:
 * 1) InviteCode 검증 (존재 / 미사용 / 미폐기 / 미만료 / 회사 일치)
 * 2) 이메일 중복 검사
 * 3) bcrypt 12 round password hash
 * 4) Transaction:
 *    - User create (role=EMPLOYEE, status=ACTIVE, emailVerifiedAt=null,
 *      anonymizedId=BLAKE2b(id, salt))
 *    - InviteCode update (usedAt, usedById)
 *    - Consent (서비스 약관 v1 동의는 가입 폼 클릭 = 묵시 동의 — 단계 5에서 명시 동의 별도 기록)
 *
 * Day 12 (Resend) 이전: emailVerifiedAt=null 상태로 두고 verify-pending 화면에서
 * dev 모드 자동 인증 버튼으로 채워줌. status 는 ACTIVE 이므로 즉시 로그인 가능.
 *
 * 멱등성 없음: 같은 email 재호출 시 throw.
 */

const inputSchema = z.object({
  code: z
    .string()
    .trim()
    .min(4)
    .max(64)
    .regex(/^[A-Z0-9-]+$/i, "초대코드 형식이 올바르지 않습니다."),
  email: z
    .string()
    .trim()
    .email("이메일 형식이 올바르지 않습니다.")
    .max(254)
    .transform((v) => v.toLowerCase()),
  password: z
    .string()
    .min(10, "비밀번호는 최소 10자입니다.")
    .max(128),
});

export type SignUpInput = z.infer<typeof inputSchema>;
export type SignUpResult =
  | { ok: true; userId: string; email: string }
  | { ok: false; error: string; field?: "code" | "email" | "password" };

export async function signUpWithInvite(input: SignUpInput): Promise<SignUpResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: issue.message,
      field: issue.path[0] as "code" | "email" | "password",
    };
  }
  const { code, email, password } = parsed.data;

  const invite = await prisma.inviteCode.findUnique({
    where: { code: code.toUpperCase() },
    select: { id: true, companyId: true, usedAt: true, revokedAt: true, expiresAt: true, email: true },
  });
  if (!invite) {
    return { ok: false, error: "초대코드를 찾을 수 없습니다.", field: "code" };
  }
  if (invite.usedAt) {
    return { ok: false, error: "이미 사용된 초대코드입니다.", field: "code" };
  }
  if (invite.revokedAt) {
    return { ok: false, error: "폐기된 초대코드입니다.", field: "code" };
  }
  if (invite.expiresAt < new Date()) {
    return { ok: false, error: "만료된 초대코드입니다.", field: "code" };
  }
  if (invite.email && invite.email.toLowerCase() !== email) {
    return { ok: false, error: "초대코드와 이메일이 일치하지 않습니다.", field: "email" };
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    return { ok: false, error: "이미 가입된 이메일입니다.", field: "email" };
  }

  const passwordHash = await hash(password, 12);
  const userId = randomUUID();
  const anonymizedId = anonymizeIdFromEnv(userId);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          id: userId,
          email,
          passwordHash,
          role: "EMPLOYEE",
          status: "ACTIVE",
          companyId: invite.companyId,
          anonymizedId,
          // nickname 은 단계 6 에 채움
          // emailVerifiedAt 은 단계 3~4 (dev mode 자동) 에 채움
        },
      });
      await tx.inviteCode.update({
        where: { id: invite.id },
        data: { usedAt: new Date(), usedById: userId },
      });
    });
  } catch (e) {
    console.error("[signUpWithInvite] tx failed", e);
    return { ok: false, error: "가입 처리 중 오류가 발생했습니다." };
  }

  return { ok: true, userId, email };
}

/**
 * dev mode 자동 이메일 인증 (Day 12 Resend 도입 전까지의 우회).
 * Day 12 이후엔 verify token + Resend 발송으로 대체될 함수 자리.
 */
export async function devVerifyEmail(userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, emailVerifiedAt: true },
  });
  if (!user) return { ok: false, error: "사용자를 찾을 수 없습니다." };
  if (user.emailVerifiedAt) return { ok: true };
  await prisma.user.update({
    where: { id: userId },
    data: { emailVerifiedAt: new Date() },
  });
  return { ok: true };
}
