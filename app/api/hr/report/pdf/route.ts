/**
 * HR 월간 리포트 PDF 다운로드 route handler (Day 24).
 *
 * GET /api/hr/report/pdf?startISO=...&endISO=...
 *
 * 권한: HR 또는 ADMIN. companyId 자동 격리.
 * 가드: BR-7 미달 시 403 + 안내 메시지.
 *
 * server action 으로 binary 반환이 불가해 route handler 채택.
 * react-pdf 의 renderToBuffer 로 서버측 buffer 생성.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  checkPublishable,
  computeDashboard,
} from "@/lib/hr/aggregate";
import { generateHRInsight } from "@/lib/ai/insight";

export const runtime = "nodejs"; // react-pdf 는 Node runtime 필요 (Edge 비호환)

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (
    !session?.user ||
    (session.user.role !== "HR" && session.user.role !== "ADMIN")
  ) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  if (!session.user.companyId) {
    return new NextResponse("회사 정보가 없는 HR 계정입니다.", { status: 400 });
  }

  const url = new URL(req.url);
  const startISO = url.searchParams.get("startISO");
  const endISO = url.searchParams.get("endISO");
  if (!startISO || !endISO) {
    return new NextResponse("startISO·endISO 가 필요합니다.", { status: 400 });
  }
  const start = new Date(startISO);
  const end = new Date(endISO);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
    return new NextResponse("기간 입력이 올바르지 않습니다.", { status: 400 });
  }

  const gate = await checkPublishable(prisma, session.user.companyId);
  if (!gate.ok) {
    return new NextResponse(
      `발행 조건 미달 (BR-7): 회사 직원 ${gate.headcount}명, 통계 동의자 ${gate.consenters}명.`,
      { status: 403 },
    );
  }

  const data = await computeDashboard(prisma, {
    companyId: session.user.companyId,
    period: { start, end },
  });

  const insight = await generateHRInsight(data);

  const company = await prisma.company.findUnique({
    where: { id: session.user.companyId },
    select: { name: true },
  });

  // 동적 import — react-pdf 는 ESM/CJS 혼합 이슈가 있어 호출 시점에만 로드
  const { renderToBuffer } = await import("@react-pdf/renderer");
  const { HRReportPdf } = await import("@/lib/pdf/hr-report");

  const periodLabel = `${fmtDate(start)} ~ ${fmtDate(end)}`;
  const generatedAtLabel = fmtDateTime(new Date());

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(
    HRReportPdf({
      data,
      insight,
      companyName: company?.name ?? "MindBridge",
      periodLabel,
      generatedAtLabel,
    }) as any,
  );

  // AuditLog — HR 리포트 발행 흔적
  await prisma.auditLog.create({
    data: {
      actorId: session.user.id,
      action: "GENERATE_HR_REPORT_PDF",
      resourceType: "HRReport",
      resourceId: `pdf:${start.toISOString()}~${end.toISOString()}`,
      metadata: {
        companyId: session.user.companyId,
        headcount: gate.headcount,
        consenters: gate.consenters,
      },
    },
  });

  const filename = `mindbridge-hr-report-${fmtFilename(start)}_${fmtFilename(end)}.pdf`;
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function fmtDateTime(d: Date): string {
  return d.toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function fmtFilename(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}
