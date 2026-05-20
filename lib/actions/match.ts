"use server";

import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/with-auth";
import { rankCounselors, type RankedCounselor } from "@/lib/matching";

/**
 * PRD §6.1.1 listRecommendedCounselors — assessmentId 기반 상위 3명.
 *
 * 동작:
 *   1) assessment 본인 소유 확인 (아니면 AuditLog + throw)
 *   2) Counselor 풀: approvedAt set + suspendedAt null
 *   3) 각 counselor 에 대해 이 직원과의 prior booking 여부 조회
 *   4) BR-4 가중치로 rank, top 3
 *   5) MatchRecommendation 멱등 저장 (assessmentId 기존 row 삭제 후 재기록)
 *
 * 반환: top 3 counselor + score breakdown + reasonText.
 */

export interface RecommendedCounselor {
  counselorId: string;
  userId: string;
  nickname: string;
  bio: string | null;
  tier: string;
  rating: number | null;
  ratingCount: number;
  yearsOfPractice: number;
  totalScore: number;
  reasonText: string;
}

export const listRecommendedCounselors = withAuth(
  { action: "read", subject: "Counselor" },
  async (ctx, input: { assessmentId: string }): Promise<RecommendedCounselor[]> => {
    const assessment = await prisma.assessment.findUnique({
      where: { id: input.assessmentId },
      select: {
        id: true,
        userId: true,
        primaryCategoryId: true,
        secondaryCategoryIds: true,
        status: true,
      },
    });
    if (!assessment) throw new Error("자가진단을 찾을 수 없습니다.");
    if (assessment.userId !== ctx.user.id) {
      await prisma.auditLog.create({
        data: {
          actorId: ctx.user.id,
          action: "PERMISSION_DENIED",
          resourceType: "OwnAssessment",
          resourceId: assessment.id,
          metadata: { reason: "not owner", at: "listRecommendedCounselors" },
        },
      });
      throw new Error("권한이 없습니다.");
    }
    if (assessment.status !== "COMPLETED") {
      throw new Error("완료된 자가진단만 추천 대상입니다.");
    }

    const pool = await prisma.counselor.findMany({
      where: {
        approvedAt: { not: null },
        suspendedAt: null,
        user: { status: "ACTIVE" },
      },
      include: {
        user: { select: { id: true, nickname: true } },
        categories: true,
        availability: true,
      },
    });

    // 각 counselor 의 user.id 로 이 직원과의 prior booking 조회 (한 번에)
    const priorBookings = await prisma.booking.findMany({
      where: {
        employeeId: ctx.user.id,
        counselorId: { in: pool.map((c) => c.userId) },
      },
      select: { counselorId: true },
    });
    const priorBookingSet = new Set(priorBookings.map((b) => b.counselorId));

    const ranked = rankCounselors(
      pool.map((c) => ({
        counselor: c,
        hasPriorBookingWithEmployee: priorBookingSet.has(c.userId),
      })),
      assessment.primaryCategoryId,
      assessment.secondaryCategoryIds,
    );

    const top3 = ranked.slice(0, 3);

    // 멱등 저장
    await prisma.$transaction([
      prisma.matchRecommendation.deleteMany({ where: { assessmentId: assessment.id } }),
      prisma.matchRecommendation.createMany({
        data: top3.map((r, idx) => ({
          assessmentId: assessment.id,
          counselorId: r.counselor.id,
          rank: idx + 1,
          score: r.score.total,
          reasonText: r.reasonText,
        })),
      }),
    ]);

    return top3.map((r) => formatRecommendation(r));
  },
);

function formatRecommendation(r: RankedCounselor): RecommendedCounselor {
  const counselor = r.counselor as RankedCounselor["counselor"] & {
    user: { id: string; nickname: string | null };
  };
  return {
    counselorId: counselor.id,
    userId: counselor.user.id,
    nickname: counselor.user.nickname ?? "이름 없음",
    bio: counselor.bio,
    tier: counselor.tier,
    rating: counselor.rating,
    ratingCount: counselor.ratingCount,
    yearsOfPractice: counselor.yearsOfPractice,
    totalScore: r.score.total,
    reasonText: r.reasonText,
  };
}
