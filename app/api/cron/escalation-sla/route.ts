import { NextResponse } from "next/server";

import { runSlaCron } from "@/lib/escalation/sla-cron";

/**
 * /api/cron/escalation-sla — D20 Escalation SLA 만료 처리.
 *
 * 보호: CRON_SECRET Bearer 토큰 (outbox cron 과 동일 패턴).
 *   - Vercel cron: 자동 헤더 첨부
 *   - 로컬: curl -H "Authorization: Bearer dev" http://localhost:3000/api/cron/escalation-sla
 *
 * 처리 흐름:
 *   PENDING/IN_REVIEW + slaDueAt <= now → EXPIRED 전이 + 운영자(ADMIN) 전체에
 *   ESCALATION_EXPIRED 알림 enqueue (dedupeKey 멱등).
 *
 * SLA 기준은 ESCALATION_SLA_HOURS (env, default 24) 또는 dev 전용
 * ESCALATION_SLA_MINUTES_OVERRIDE 로 단축 가능 — `lib/escalation/sla.ts` 참조.
 */

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  const isProd = process.env.NODE_ENV === "production";

  if (secret) {
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  } else if (isProd) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured in production" },
      { status: 500 },
    );
  }

  const result = await runSlaCron(50);
  return NextResponse.json({ ok: true, ...result });
}

export const POST = GET;
