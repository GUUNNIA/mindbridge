import type { NotificationType, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { provider } from "./provider";
import { renderTemplate, type TemplatePayload } from "./templates";

/**
 * Transactional outbox (Day 12).
 *
 * enqueue: 비즈니스 트랜잭션 내부에서 호출 → row PENDING 으로 INSERT.
 * processOutbox: cron worker — PENDING/FAILED row 를 batch 로 가져와 provider 전송.
 *
 * dedupeKey 로 멱등성 보장 — 같은 키로 두 번 enqueue 해도 row 1개.
 * 재시도 정책: attempts < MAX_ATTEMPTS 면 FAILED + backoff, 초과 시 DEAD.
 */

const MAX_ATTEMPTS = 5;

// PrismaClient 또는 트랜잭션 client 둘 다 받음
type Tx = Prisma.TransactionClient | typeof prisma;

export interface EnqueueInput {
  type: NotificationType;
  recipientEmail: string;
  recipientUserId?: string | null;
  payload: TemplatePayload;
  dedupeKey?: string;
}

export async function enqueue(
  tx: Tx,
  input: EnqueueInput,
): Promise<{ id: string; existed: boolean }> {
  if (input.dedupeKey) {
    const existing = await tx.notificationOutbox.findUnique({
      where: { dedupeKey: input.dedupeKey },
      select: { id: true },
    });
    if (existing) return { id: existing.id, existed: true };
  }

  const rendered = renderTemplate(input.type, input.payload);
  const row = await tx.notificationOutbox.create({
    data: {
      type: input.type,
      recipientEmail: input.recipientEmail,
      recipientUserId: input.recipientUserId ?? null,
      subject: rendered.subject,
      payload: input.payload as unknown as Prisma.InputJsonValue,
      dedupeKey: input.dedupeKey,
    },
    select: { id: true },
  });
  return { id: row.id, existed: false };
}

export interface ProcessResult {
  picked: number;
  sent: number;
  failed: number;
  dead: number;
}

export async function processOutbox(batchSize = 10): Promise<ProcessResult> {
  const now = new Date();
  const rows = await prisma.notificationOutbox.findMany({
    where: {
      status: { in: ["PENDING", "FAILED"] },
      scheduledAt: { lte: now },
      attempts: { lt: MAX_ATTEMPTS },
    },
    orderBy: { scheduledAt: "asc" },
    take: batchSize,
  });

  let sent = 0;
  let failed = 0;
  let dead = 0;

  for (const row of rows) {
    const rendered = renderTemplate(row.type, row.payload as unknown as TemplatePayload);
    const r = await provider.send({
      to: row.recipientEmail,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });

    const nextAttempts = row.attempts + 1;

    if (r.ok) {
      await prisma.notificationOutbox.update({
        where: { id: row.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          providerMessageId: r.providerMessageId,
          attempts: nextAttempts,
          lastError: null,
        },
      });
      sent++;
    } else {
      const isDead = nextAttempts >= MAX_ATTEMPTS;
      // exponential backoff (분): 2, 4, 8, 16, 32
      const backoffMs = Math.pow(2, nextAttempts) * 60 * 1000;
      await prisma.notificationOutbox.update({
        where: { id: row.id },
        data: {
          status: isDead ? "DEAD" : "FAILED",
          attempts: nextAttempts,
          lastError: r.error?.slice(0, 500) ?? "unknown error",
          scheduledAt: isDead ? row.scheduledAt : new Date(now.getTime() + backoffMs),
        },
      });
      if (isDead) dead++;
      else failed++;
    }
  }

  return { picked: rows.length, sent, failed, dead };
}
