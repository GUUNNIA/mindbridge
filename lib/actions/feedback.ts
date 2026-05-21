"use server";

import { z } from "zod";

import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/with-auth";
import { applyNewRating } from "@/lib/feedback/rating";

/**
 * Feedback server actions (D21, PRD §6.1.1 UC-5).
 *
 * - submitFeedback: 직원 본인 세션 + COMPLETED + 미작성 검증. Feedback INSERT +
 *   Counselor.rating·ratingCount 트랜잭션 갱신.
 * - getFeedback: 직원 본인 작성한 피드백 read (작성 후 조회 화면용).
 *   상담사가 본인 받은 피드백 코멘트 read 는 V2 — V1 은 집계만.
 *
 * 권한 (ability):
 *   - EMPLOYEE: read·create Feedback (자원 단위 = session.employeeId === ctx.user.id)
 *   - COUNSELOR: read Feedback (자원 단위 = feedback.counselorId === ctx.user.id, V2)
 *   - HR/PSYCHIATRIST/ADMIN: 거부 또는 manage(ADMIN)
 *
 * 부동소수 평균 갱신은 lib/feedback/rating.ts applyNewRating — 단위 테스트 가능.
 */

const SubmitInput = z.object({
  sessionId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
  wantSameCounselor: z.boolean(),
});

export type SubmitFeedbackInput = z.infer<typeof SubmitInput>;

export const submitFeedback = withAuth(
  { action: "create", subject: "Feedback" },
  async (
    ctx,
    rawInput: SubmitFeedbackInput,
  ): Promise<{ ok: true; feedbackId: string } | { ok: false; error: string }> => {
    const parsed = SubmitInput.safeParse(rawInput);
    if (!parsed.success) {
      return { ok: false, error: "입력값이 올바르지 않습니다 (평점 1~5)." };
    }
    const input = parsed.data;

    const session = await prisma.session.findUnique({
      where: { id: input.sessionId },
      select: {
        id: true,
        status: true,
        employeeId: true,
        counselorId: true,
        feedback: { select: { id: true } },
      },
    });
    if (!session) return { ok: false, error: "세션을 찾을 수 없습니다." };

    if (session.employeeId !== ctx.user.id) {
      await prisma.auditLog.create({
        data: {
          actorId: ctx.user.id,
          action: "PERMISSION_DENIED",
          resourceType: "Feedback",
          resourceId: session.id,
          metadata: { reason: "not session employee", at: "submitFeedback" },
        },
      });
      return { ok: false, error: "본인 세션에만 피드백을 작성할 수 있습니다." };
    }
    if (session.status !== "COMPLETED") {
      return { ok: false, error: "세션이 종료된 후에만 피드백을 작성할 수 있습니다." };
    }
    if (session.feedback) {
      return { ok: false, error: "이미 피드백을 작성한 세션입니다." };
    }

    // Counselor 집계 갱신용 row (counselorId 는 User.id 이므로 Counselor 모델은 userId 로 lookup)
    const counselorRow = await prisma.counselor.findUnique({
      where: { userId: session.counselorId },
      select: { id: true, rating: true, ratingCount: true },
    });

    const created = await prisma.$transaction(async (tx) => {
      const feedback = await tx.feedback.create({
        data: {
          sessionId: session.id,
          employeeId: session.employeeId,
          counselorId: session.counselorId,
          rating: input.rating,
          comment: input.comment ?? null,
          wantSameCounselor: input.wantSameCounselor,
        },
        select: { id: true },
      });

      if (counselorRow) {
        const next = applyNewRating(
          { rating: counselorRow.rating, ratingCount: counselorRow.ratingCount },
          input.rating,
        );
        await tx.counselor.update({
          where: { id: counselorRow.id },
          data: { rating: next.rating, ratingCount: next.ratingCount },
        });
      }

      return feedback;
    });

    return { ok: true, feedbackId: created.id };
  },
);

export const getFeedback = withAuth(
  { action: "read", subject: "Feedback" },
  async (
    ctx,
    input: { sessionId: string },
  ): Promise<
    | {
        ok: true;
        feedback: {
          rating: number;
          comment: string | null;
          wantSameCounselor: boolean;
          createdAt: Date;
        } | null;
      }
    | { ok: false; error: string }
  > => {
    const session = await prisma.session.findUnique({
      where: { id: input.sessionId },
      select: {
        id: true,
        employeeId: true,
        counselorId: true,
      },
    });
    if (!session) return { ok: false, error: "세션을 찾을 수 없습니다." };

    // EMPLOYEE: 본인 세션만. COUNSELOR: 본인 담당 세션만 (V2 코멘트 노출용 자리이지만 V1 도 read 만은 OK).
    // 다른 롤은 ability 단에서 거부됨.
    const isOwner =
      session.employeeId === ctx.user.id || session.counselorId === ctx.user.id;
    if (!isOwner) {
      await prisma.auditLog.create({
        data: {
          actorId: ctx.user.id,
          action: "PERMISSION_DENIED",
          resourceType: "Feedback",
          resourceId: session.id,
          metadata: { reason: "not session participant", at: "getFeedback" },
        },
      });
      return { ok: false, error: "이 세션의 피드백을 볼 권한이 없습니다." };
    }

    const fb = await prisma.feedback.findUnique({
      where: { sessionId: session.id },
      select: {
        rating: true,
        comment: true,
        wantSameCounselor: true,
        createdAt: true,
      },
    });
    return { ok: true, feedback: fb };
  },
);
