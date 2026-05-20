"use server";

import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/with-auth";
import { assistantReply, detectCrisis, shouldComplete } from "@/lib/ai/triage";
import { classifyCategory } from "@/lib/ai/client";

/**
 * PRD §6.1.1 직원 자가진단 Server Actions.
 *
 * - startAssessment: IN_PROGRESS 자가진단 row 가 있으면 그대로 반환, 없으면 새로 생성.
 *   재진입 친화. resetAssessment 는 별도 (Day 9 범위 외).
 * - sendAssessmentMessage: User 메시지 저장 → turn 판정 → ASSISTANT reply 또는
 *   완료 시 classify_category tool 호출 + Assessment update.
 *
 * 권한: 모든 액션 withAuth + EMPLOYEE 의 OwnAssessment ability.
 *       본인 소유 row 가 아니면 AuditLog 기록 후 throw.
 */

export const startAssessment = withAuth(
  { action: "create", subject: "OwnAssessment" },
  async (ctx): Promise<{ assessmentId: string }> => {
    const existing = await prisma.assessment.findFirst({
      where: { userId: ctx.user.id, status: "IN_PROGRESS" },
      orderBy: { startedAt: "desc" },
      select: { id: true },
    });
    if (existing) return { assessmentId: existing.id };

    const created = await prisma.assessment.create({
      data: { userId: ctx.user.id, status: "IN_PROGRESS" },
      select: { id: true },
    });
    return { assessmentId: created.id };
  },
);

/** /app/assessment 진입 페이지가 호출. 시작 + redirect 까지. */
export async function startAssessmentAndRedirect() {
  const { assessmentId } = await startAssessment();
  redirect(`/app/assessment/${assessmentId}`);
}

export type SendMessageResult = {
  reply: string;
  completed?: boolean;
  riskFlagged?: boolean;
};

export const sendAssessmentMessage = withAuth(
  { action: "update", subject: "OwnAssessment" },
  async (
    ctx,
    input: { assessmentId: string; text: string },
  ): Promise<SendMessageResult> => {
    const assessment = await prisma.assessment.findUnique({
      where: { id: input.assessmentId },
      include: { responses: { orderBy: { createdAt: "asc" } } },
    });
    if (!assessment) {
      throw new Error("자가진단을 찾을 수 없습니다.");
    }
    if (assessment.userId !== ctx.user.id) {
      // 본인 소유 아님 — AuditLog 기록 후 throw
      await prisma.auditLog.create({
        data: {
          actorId: ctx.user.id,
          action: "PERMISSION_DENIED",
          resourceType: "OwnAssessment",
          resourceId: assessment.id,
          metadata: { reason: "not owner" },
        },
      });
      throw new Error("권한이 없습니다.");
    }
    if (assessment.status !== "IN_PROGRESS") {
      return { reply: "이미 완료된 자가진단입니다.", completed: true };
    }

    const text = input.text.trim();
    if (!text) {
      return { reply: "내용을 입력해 주세요." };
    }

    const isCrisis = detectCrisis(text);

    await prisma.assessmentResponse.create({
      data: {
        assessmentId: assessment.id,
        role: "USER",
        content: text,
        riskFlagged: isCrisis,
      },
    });

    const assistantCount = assessment.responses.filter((r) => r.role === "ASSISTANT").length;
    const userTextsSoFar = [
      ...assessment.responses.filter((r) => r.role === "USER").map((r) => r.content),
      text,
    ].join("\n");

    const complete = shouldComplete(assistantCount, userTextsSoFar);

    if (!complete) {
      const reply = assistantReply(assistantCount);
      await prisma.assessmentResponse.create({
        data: {
          assessmentId: assessment.id,
          role: "ASSISTANT",
          content: reply,
        },
      });
      return { reply, riskFlagged: isCrisis };
    }

    // 완료 — 종합 멘트 + classify_category
    const closingMsg = assistantReply(assistantCount);
    await prisma.assessmentResponse.create({
      data: {
        assessmentId: assessment.id,
        role: "ASSISTANT",
        content: closingMsg,
      },
    });

    const transcript = [
      ...assessment.responses.map((r) => `${r.role}: ${r.content}`),
      `USER: ${text}`,
      `ASSISTANT: ${closingMsg}`,
    ].join("\n");

    const summary = await classifyCategory(transcript);
    const primaryCat = await prisma.category.findUnique({
      where: { slug: summary.primaryCategory },
      select: { id: true },
    });
    const secondaryCats =
      summary.secondaryCategories.length > 0
        ? await prisma.category.findMany({
            where: { slug: { in: summary.secondaryCategories } },
            select: { id: true },
          })
        : [];

    await prisma.assessment.update({
      where: { id: assessment.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        primaryCategoryId: primaryCat?.id ?? null,
        secondaryCategoryIds: secondaryCats.map((c) => c.id),
        severity: summary.severity,
        summaryForCounselor: summary.summaryForCounselor,
        summaryForEmployee: summary.summaryForEmployee,
      },
    });

    return { reply: closingMsg, completed: true, riskFlagged: isCrisis };
  },
);
