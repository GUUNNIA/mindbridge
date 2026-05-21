"use server";

import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/with-auth";

/**
 * 상담사 케이스 (Day 16, PRD §6.1.1 listMyCases / getCase).
 *
 * V1 단순화: 1 booking = 1 case. (employeeId, counselorId) 페어의 여러 booking
 * 은 "이전 노트" join 으로 시계열 표시 (D17 ClinicalNote 도입 후 활성).
 *
 * 권한:
 *   - COUNSELOR: read Booking + read CaseAssessment (ability matrix). 본인 담당
 *     필터는 server action 내부에서 counselorId === ctx.user.id 검증.
 *   - 다른 롤은 ability 거부 → ForbiddenError + AuditLog.
 */

export interface CaseRow {
  bookingId: string;
  scheduledAt: Date;
  status: string;
  employee: { id: string; nickname: string | null };
  assessment: {
    severity: string | null;
    primaryCategoryName: string | null;
  } | null;
  sessionStatus: string | null;
  sessionId: string | null;
  noteStatus: "DRAFT" | "FINALIZED" | null; // null = 노트 미작성
}

export const listCounselorCases = withAuth(
  { action: "read", subject: "Booking" },
  async (ctx): Promise<CaseRow[]> => {
    // 본인 담당 = booking.counselorId (= User.id) 와 ctx.user.id 일치
    const bookings = await prisma.booking.findMany({
      where: { counselorId: ctx.user.id },
      orderBy: { scheduledAt: "asc" },
      take: 100,
      select: {
        id: true,
        scheduledAt: true,
        status: true,
        employee: { select: { id: true, nickname: true } },
        session: {
          select: {
            id: true,
            status: true,
            clinicalNote: { select: { status: true } },
          },
        },
      },
    });

    if (bookings.length === 0) return [];

    // 직원의 최근 completed Assessment 일괄 조회 (N+1 회피)
    const employeeIds = [...new Set(bookings.map((b) => b.employee.id))];
    const assessments = await prisma.assessment.findMany({
      where: {
        userId: { in: employeeIds },
        status: "COMPLETED",
      },
      orderBy: { completedAt: "desc" },
      select: {
        userId: true,
        severity: true,
        primaryCategoryId: true,
      },
    });
    // userId → 최근 1건 (이미 desc orderBy)
    const latestByUser = new Map<string, (typeof assessments)[number]>();
    for (const a of assessments) {
      if (!latestByUser.has(a.userId)) latestByUser.set(a.userId, a);
    }

    const categoryIds = [
      ...new Set(
        [...latestByUser.values()]
          .map((a) => a.primaryCategoryId)
          .filter((id): id is string => id != null),
      ),
    ];
    const categories =
      categoryIds.length > 0
        ? await prisma.category.findMany({
            where: { id: { in: categoryIds } },
            select: { id: true, name: true },
          })
        : [];
    const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));

    return bookings.map((b) => {
      const a = latestByUser.get(b.employee.id);
      return {
        bookingId: b.id,
        scheduledAt: b.scheduledAt,
        status: b.status,
        employee: { id: b.employee.id, nickname: b.employee.nickname },
        assessment: a
          ? {
              severity: a.severity,
              primaryCategoryName: a.primaryCategoryId
                ? (categoryNameById.get(a.primaryCategoryId) ?? null)
                : null,
            }
          : null,
        sessionStatus: b.session?.status ?? null,
        sessionId: b.session?.id ?? null,
        noteStatus: b.session?.clinicalNote?.status ?? null,
      };
    });
  },
);

export interface CaseDetail {
  bookingId: string;
  scheduledAt: Date;
  status: string;
  cancelReason: string | null;
  employee: { id: string; nickname: string | null };
  assessment: {
    id: string;
    severity: string | null;
    primaryCategoryName: string | null;
    secondaryCategoryNames: string[];
    summaryForCounselor: string | null;
    completedAt: Date | null;
  } | null;
  session: { id: string; status: string; startedAt: Date | null } | null;
  noteStatus: "DRAFT" | "FINALIZED" | null;
  // D17 ClinicalNote 도입 후 채워질 자리. V1 D16 은 빈 배열 (placeholder).
  priorNotes: { bookingId: string; scheduledAt: Date; placeholder: true }[];
}

export const getCounselorCase = withAuth(
  { action: "read", subject: "Booking" },
  async (
    ctx,
    input: { bookingId: string },
  ): Promise<{ ok: true; case: CaseDetail } | { ok: false; error: string }> => {
    const booking = await prisma.booking.findUnique({
      where: { id: input.bookingId },
      select: {
        id: true,
        scheduledAt: true,
        status: true,
        cancelReason: true,
        counselorId: true,
        employeeId: true,
        employee: { select: { id: true, nickname: true } },
        session: {
          select: {
            id: true,
            status: true,
            startedAt: true,
            clinicalNote: { select: { status: true } },
          },
        },
      },
    });
    if (!booking) return { ok: false, error: "케이스를 찾을 수 없습니다." };
    if (booking.counselorId !== ctx.user.id) {
      await prisma.auditLog.create({
        data: {
          actorId: ctx.user.id,
          action: "PERMISSION_DENIED",
          resourceType: "Booking",
          resourceId: booking.id,
          metadata: { reason: "not assigned counselor", at: "getCounselorCase" },
        },
      });
      return { ok: false, error: "본인 담당 케이스가 아닙니다." };
    }

    // Assessment 요약 (CaseAssessment ability 의 자원 — 본인 담당 booking 의
    // 직원 것이므로 view 권한 정당화. ability 단위는 자원 단위 conditions 없이
    // 통과시키고 여기서 booking 본인 검사로 자원 격리)
    const latestAssessment = await prisma.assessment.findFirst({
      where: { userId: booking.employee.id, status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
      select: {
        id: true,
        severity: true,
        primaryCategoryId: true,
        secondaryCategoryIds: true,
        summaryForCounselor: true,
        completedAt: true,
      },
    });

    let assessment: CaseDetail["assessment"] = null;
    if (latestAssessment) {
      const catIds = [
        ...(latestAssessment.primaryCategoryId
          ? [latestAssessment.primaryCategoryId]
          : []),
        ...latestAssessment.secondaryCategoryIds,
      ];
      const cats =
        catIds.length > 0
          ? await prisma.category.findMany({
              where: { id: { in: catIds } },
              select: { id: true, name: true },
            })
          : [];
      const nameById = new Map(cats.map((c) => [c.id, c.name]));
      assessment = {
        id: latestAssessment.id,
        severity: latestAssessment.severity,
        primaryCategoryName: latestAssessment.primaryCategoryId
          ? (nameById.get(latestAssessment.primaryCategoryId) ?? null)
          : null,
        secondaryCategoryNames: latestAssessment.secondaryCategoryIds
          .map((id) => nameById.get(id))
          .filter((n): n is string => !!n),
        summaryForCounselor: latestAssessment.summaryForCounselor,
        completedAt: latestAssessment.completedAt,
      };
    }

    // 이전 booking (같은 employee·counselor 페어의 이 booking 이전 것들). D17
    // ClinicalNote 도입 후 노트 join 으로 시계열 표시.
    const priorBookings = await prisma.booking.findMany({
      where: {
        counselorId: ctx.user.id,
        employeeId: booking.employee.id,
        scheduledAt: { lt: booking.scheduledAt },
      },
      orderBy: { scheduledAt: "desc" },
      take: 10,
      select: { id: true, scheduledAt: true },
    });

    return {
      ok: true,
      case: {
        bookingId: booking.id,
        scheduledAt: booking.scheduledAt,
        status: booking.status,
        cancelReason: booking.cancelReason,
        employee: booking.employee,
        assessment,
        session: booking.session
          ? {
              id: booking.session.id,
              status: booking.session.status,
              startedAt: booking.session.startedAt,
            }
          : null,
        noteStatus: booking.session?.clinicalNote?.status ?? null,
        priorNotes: priorBookings.map((b) => ({
          bookingId: b.id,
          scheduledAt: b.scheduledAt,
          placeholder: true as const,
        })),
      },
    };
  },
);
