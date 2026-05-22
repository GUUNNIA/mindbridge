"use server";

import { z } from "zod";

import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/with-auth";

/**
 * 감사 로그 검색 (PRD §6.1.5 searchAuditLogs, Day 25).
 *
 * 권한: ADMIN read AuditLog. CSV 내보내기는 V2.
 *
 * 필터: actorId · resourceType · action · 기간 (KST 입력, UTC 저장이므로 ISO 변환은 호출 측).
 * 페이징: 단순 take/skip (50건 단위 기본, max 200).
 */

const searchSchema = z.object({
  actorId: z.string().uuid().optional(),
  resourceType: z.string().max(64).optional(),
  action: z.string().max(64).optional(),
  fromISO: z.string().datetime().optional(),
  toISO: z.string().datetime().optional(),
  take: z.number().int().min(1).max(200).optional(),
  skip: z.number().int().min(0).max(10_000).optional(),
});

export type SearchAuditLogsInput = z.infer<typeof searchSchema>;

export interface AuditLogRow {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata: unknown;
  timestamp: Date;
}

export interface SearchAuditLogsResult {
  rows: AuditLogRow[];
  total: number;
  take: number;
  skip: number;
}

export const searchAuditLogs = withAuth(
  { action: "read", subject: "AuditLog" },
  async (
    _ctx,
    input: SearchAuditLogsInput = {},
  ): Promise<SearchAuditLogsResult> => {
    const parsed = searchSchema.parse(input);
    const take = parsed.take ?? 50;
    const skip = parsed.skip ?? 0;

    const whereClause = {
      ...(parsed.actorId ? { actorId: parsed.actorId } : {}),
      ...(parsed.resourceType ? { resourceType: parsed.resourceType } : {}),
      ...(parsed.action ? { action: parsed.action } : {}),
      ...((parsed.fromISO || parsed.toISO)
        ? {
            timestamp: {
              ...(parsed.fromISO ? { gte: new Date(parsed.fromISO) } : {}),
              ...(parsed.toISO ? { lt: new Date(parsed.toISO) } : {}),
            },
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: whereClause,
        orderBy: { timestamp: "desc" },
        take,
        skip,
        include: {
          actor: { select: { email: true, role: true } },
        },
      }),
      prisma.auditLog.count({ where: whereClause }),
    ]);

    return {
      rows: rows.map((r) => ({
        id: r.id,
        actorId: r.actorId,
        actorEmail: r.actor?.email ?? null,
        actorRole: r.actor?.role ?? null,
        action: r.action,
        resourceType: r.resourceType,
        resourceId: r.resourceId,
        metadata: r.metadata,
        timestamp: r.timestamp,
      })),
      total,
      take,
      skip,
    };
  },
);

/**
 * 필터 옵션용 distinct 값 — 자주 쓰는 action·resourceType 후보.
 * 화면의 select 옵션에 사용.
 */
export const listAuditLogFacets = withAuth(
  { action: "read", subject: "AuditLog" },
  async (): Promise<{
    actions: string[];
    resourceTypes: string[];
  }> => {
    const [actions, resourceTypes] = await Promise.all([
      prisma.auditLog.findMany({
        distinct: ["action"],
        select: { action: true },
        orderBy: { action: "asc" },
        take: 50,
      }),
      prisma.auditLog.findMany({
        distinct: ["resourceType"],
        select: { resourceType: true },
        orderBy: { resourceType: "asc" },
        take: 50,
      }),
    ]);
    return {
      actions: actions.map((a) => a.action),
      resourceTypes: resourceTypes.map((r) => r.resourceType),
    };
  },
);
