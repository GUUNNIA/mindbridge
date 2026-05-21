import { prisma } from "@/lib/db";
import { enqueue } from "@/lib/notifications/outbox";

/**
 * SLA cron 본체 (D20).
 *
 * PENDING / IN_REVIEW 중 slaDueAt <= now 인 row 를 batch 로 EXPIRED 전이.
 * BR-6: 미준수 시 운영자 즉시 알림 — NotificationOutbox 에 ESCALATION_EXPIRED enqueue.
 * V1 자동 재배정은 skip (PRD §1.3 자동화 범위 제한). EXPIRED 후엔 화면·이메일 양쪽으로 운영자 트리거.
 *
 * 동시성: 동일 SLA cron 이 중복 실행돼도 escalation.status 가 이미 EXPIRED 면 updateMany count=0,
 * dedupeKey="ESCALATION_EXPIRED:<id>" 가 이중 알림도 방지.
 */

const KST_FORMAT: Intl.DateTimeFormatOptions = {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};

export interface SlaCronResult {
  picked: number;
  expired: number;
  enqueued: number;
  adminCount: number;
}

export async function runSlaCron(batchSize = 50): Promise<SlaCronResult> {
  const now = new Date();

  // 후보 row 먼저 select — 이후 트랜잭션에서 개별 update + outbox enqueue
  const candidates = await prisma.escalation.findMany({
    where: {
      status: { in: ["PENDING", "IN_REVIEW"] },
      slaDueAt: { lte: now },
    },
    orderBy: { slaDueAt: "asc" },
    take: batchSize,
    select: {
      id: true,
      slaDueAt: true,
      subject: { select: { anonymizedId: true } },
      riskFlag: { select: { summary: true } },
    },
  });

  if (candidates.length === 0) {
    return { picked: 0, expired: 0, enqueued: 0, adminCount: 0 };
  }

  // 운영자 후보 (전체 ADMIN). 회사 격리는 V1 미구현 — 모든 ADMIN 에 알림.
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", status: "ACTIVE" },
    select: { id: true, email: true },
  });

  let expired = 0;
  let enqueued = 0;

  for (const c of candidates) {
    const result = await prisma.$transaction(async (tx) => {
      // 조건부 update — 다른 cron 인스턴스가 먼저 처리했으면 count=0
      const upd = await tx.escalation.updateMany({
        where: {
          id: c.id,
          status: { in: ["PENDING", "IN_REVIEW"] },
        },
        data: {
          status: "EXPIRED",
          expiredAt: now,
        },
      });
      if (upd.count === 0) return { expired: 0, enqueued: 0 };

      const slaDueAtKST = c.slaDueAt.toLocaleString("ko-KR", KST_FORMAT);
      let enq = 0;
      for (const a of admins) {
        await enqueue(tx, {
          type: "ESCALATION_EXPIRED",
          recipientEmail: a.email,
          recipientUserId: a.id,
          payload: {
            escalationId: c.id,
            subjectAnonymizedId: c.subject.anonymizedId,
            riskSummary: c.riskFlag.summary,
            slaDueAtKST,
          },
          dedupeKey: `ESCALATION_EXPIRED:${c.id}:${a.id}`,
        });
        enq++;
      }
      return { expired: 1, enqueued: enq };
    });
    expired += result.expired;
    enqueued += result.enqueued;
  }

  return {
    picked: candidates.length,
    expired,
    enqueued,
    adminCount: admins.length,
  };
}
