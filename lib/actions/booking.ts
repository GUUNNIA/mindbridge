"use server";

import { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/with-auth";
import { expandRecurringSlots, type Slot } from "@/lib/booking";

/**
 * 슬롯·예약 Server Actions (PRD §6.1.1).
 *
 * URL param [id] 는 Counselor.id. Booking.counselorId 는 User.id 이므로
 * 액션 내부에서 변환 (Counselor.userId).
 *
 * 동시성: Booking 모델의 @@unique([counselorId, scheduledAt]) 가 DB 수준에서
 * 강제. 동시 클릭 시 두 번째 호출은 Prisma P2002 throw → catch 해서 친화 메시지.
 */

const BOOKING_WINDOW_DAYS = 7;

export interface SlotView {
  scheduledAt: string; // ISO string (client 전달용)
}

export const listCounselorSlots = withAuth(
  { action: "read", subject: "Counselor" },
  async (
    _ctx,
    input: { counselorId: string },
  ): Promise<{ counselorId: string; counselorUserId: string; slots: SlotView[] }> => {
    const counselor = await prisma.counselor.findUnique({
      where: { id: input.counselorId },
      select: { id: true, userId: true, availability: true, suspendedAt: true, approvedAt: true },
    });
    if (!counselor) throw new Error("상담사를 찾을 수 없습니다.");
    if (counselor.suspendedAt || !counselor.approvedAt) {
      return { counselorId: counselor.id, counselorUserId: counselor.userId, slots: [] };
    }

    const now = new Date();
    const windowEnd = new Date(now.getTime() + BOOKING_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    // 활성 예약(취소·NO_SHOW 제외) 의 scheduledAt 집합
    const active = await prisma.booking.findMany({
      where: {
        counselorId: counselor.userId,
        scheduledAt: { gte: now, lte: windowEnd },
        status: { notIn: ["CANCELED_BY_USER", "CANCELED_BY_COUNSELOR", "NO_SHOW"] },
      },
      select: { scheduledAt: true },
    });
    const excluded = new Set(active.map((b) => b.scheduledAt.getTime()));

    const slots = expandRecurringSlots(counselor.availability, now, windowEnd, excluded);

    return {
      counselorId: counselor.id,
      counselorUserId: counselor.userId,
      slots: slots.map((s: Slot) => ({ scheduledAt: s.scheduledAt.toISOString() })),
    };
  },
);

const createBookingSchema = z.object({
  counselorId: z.string().min(1), // Counselor.id
  scheduledAtISO: z.string().datetime(),
});

export type CreateBookingResult =
  | { ok: true; bookingId: string }
  | { ok: false; error: string; code?: "SLOT_TAKEN" | "INVALID_SLOT" | "FORBIDDEN" };

export const createBooking = withAuth(
  { action: "create", subject: "Booking" },
  async (ctx, input: z.infer<typeof createBookingSchema>): Promise<CreateBookingResult> => {
    const parsed = createBookingSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0].message, code: "INVALID_SLOT" };
    }
    const { counselorId, scheduledAtISO } = parsed.data;

    const counselor = await prisma.counselor.findUnique({
      where: { id: counselorId },
      select: {
        userId: true,
        approvedAt: true,
        suspendedAt: true,
        availability: true,
      },
    });
    if (!counselor || !counselor.approvedAt || counselor.suspendedAt) {
      return { ok: false, error: "예약할 수 없는 상담사입니다.", code: "FORBIDDEN" };
    }

    // 슬롯이 가용 윈도 안의 정상 슬롯인지 재검증
    const scheduledAt = new Date(scheduledAtISO);
    const now = new Date();
    const windowEnd = new Date(now.getTime() + BOOKING_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    if (scheduledAt.getTime() < now.getTime() || scheduledAt.getTime() >= windowEnd.getTime()) {
      return { ok: false, error: "지나간 슬롯이거나 예약 가능한 범위를 벗어났습니다.", code: "INVALID_SLOT" };
    }
    const valid = expandRecurringSlots(counselor.availability, now, windowEnd).some(
      (s) => s.scheduledAt.getTime() === scheduledAt.getTime(),
    );
    if (!valid) {
      return { ok: false, error: "유효하지 않은 슬롯입니다.", code: "INVALID_SLOT" };
    }

    try {
      const booking = await prisma.booking.create({
        data: {
          employeeId: ctx.user.id,
          counselorId: counselor.userId,
          scheduledAt,
          status: "REQUESTED",
        },
        select: { id: true },
      });
      return { ok: true, bookingId: booking.id };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        return { ok: false, error: "이미 예약된 슬롯입니다.", code: "SLOT_TAKEN" };
      }
      throw e;
    }
  },
);

export const cancelBooking = withAuth(
  { action: "update", subject: "Booking" },
  async (ctx, input: { bookingId: string; reason: string }): Promise<{ ok: true } | { ok: false; error: string }> => {
    const booking = await prisma.booking.findUnique({
      where: { id: input.bookingId },
      select: { employeeId: true, status: true },
    });
    if (!booking) return { ok: false, error: "예약을 찾을 수 없습니다." };
    if (booking.employeeId !== ctx.user.id) {
      await prisma.auditLog.create({
        data: {
          actorId: ctx.user.id,
          action: "PERMISSION_DENIED",
          resourceType: "Booking",
          resourceId: input.bookingId,
          metadata: { reason: "not owner", at: "cancelBooking" },
        },
      });
      return { ok: false, error: "권한이 없습니다." };
    }
    if (booking.status === "CANCELED_BY_USER" || booking.status === "CANCELED_BY_COUNSELOR") {
      return { ok: false, error: "이미 취소된 예약입니다." };
    }
    if (booking.status === "COMPLETED" || booking.status === "IN_SESSION") {
      return { ok: false, error: "진행 중이거나 완료된 세션은 취소할 수 없습니다." };
    }

    await prisma.booking.update({
      where: { id: input.bookingId },
      data: { status: "CANCELED_BY_USER", cancelReason: input.reason.slice(0, 200) },
    });
    return { ok: true };
  },
);
