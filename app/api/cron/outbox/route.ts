import { NextResponse } from "next/server";

import { processOutbox } from "@/lib/notifications/outbox";
import { providerKind } from "@/lib/notifications/provider";

/**
 * /api/cron/outbox — Day 12 outbox worker 트리거.
 *
 * 보호: CRON_SECRET 헤더 (Vercel cron / 외부 cron 양쪽 호환).
 *   - Vercel cron 은 자동으로 `Authorization: Bearer ${CRON_SECRET}` 헤더 첨부
 *   - 로컬: curl -H "Authorization: Bearer dev" http://localhost:3000/api/cron/outbox
 *
 * CRON_SECRET 미설정 시 dev 모드에서만 인증 우회 (NODE_ENV !== "production").
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

  const result = await processOutbox(20);
  return NextResponse.json({ ok: true, providerKind, ...result });
}

// POST 도 동일 동작 (외부 cron 서비스 호환)
export const POST = GET;
