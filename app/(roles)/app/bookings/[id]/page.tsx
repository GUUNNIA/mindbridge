import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { enterSessionFromBooking } from "@/lib/actions/session";

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  REQUESTED: { label: "예약 요청됨", color: "bg-secondary text-secondary-foreground" },
  CONFIRMED: { label: "확정됨", color: "bg-brand-100 text-brand-700" },
  IN_SESSION: { label: "진행 중", color: "bg-risk-l1 text-foreground" },
  COMPLETED: { label: "완료", color: "bg-muted text-muted-foreground" },
  CANCELED_BY_USER: { label: "취소됨 (본인)", color: "bg-muted text-muted-foreground" },
  CANCELED_BY_COUNSELOR: { label: "취소됨 (상담사)", color: "bg-muted text-muted-foreground" },
  NO_SHOW: { label: "미입장", color: "bg-risk-l2 text-white" },
};

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "EMPLOYEE") redirect("/403");
  const { id } = await params;

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      counselor: { select: { nickname: true } },
    },
  });
  if (!booking || booking.employeeId !== session.user.id) notFound();

  const status = STATUS_LABEL[booking.status] ?? { label: booking.status, color: "" };

  return (
    <div className="mx-auto w-full max-w-xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl text-brand-700">예약 상세</CardTitle>
          <CardDescription>예약 ID: {booking.id.slice(0, 8)}…</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row label="상태">
            <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${status.color}`}>
              {status.label}
            </span>
          </Row>
          <Row label="상담사">{booking.counselor.nickname ?? "이름 없음"}</Row>
          <Row label="일시 (KST)">
            {booking.scheduledAt.toLocaleString("ko-KR", {
              timeZone: "Asia/Seoul",
              year: "numeric",
              month: "long",
              day: "numeric",
              weekday: "short",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })}
          </Row>
          {booking.cancelReason && (
            <Row label="취소 사유">{booking.cancelReason}</Row>
          )}
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button asChild variant="outline" className="flex-1">
            <Link href="/app">홈으로</Link>
          </Button>
          {canEnterSession(booking.status) ? (
            <form action={enterSessionFromBooking.bind(null, booking.id)} className="flex-1">
              <Button type="submit" className="w-full">
                세션 입장
              </Button>
            </form>
          ) : (
            <Button disabled className="flex-1">
              세션 입장 (취소된 예약)
            </Button>
          )}
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">안내</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-1">
          <p>상담사가 수락하면 상태가 CONFIRMED 로 바뀝니다 (D16 수락 UI 도입 후).</p>
          <p>예약 확정 이메일은 Outbox 로 enqueue 후 cron 발송 (현재 mock 모드).</p>
          <p>취소 UI 는 다음 Day 에 보강됩니다 — 지금은 운영자 문의 필요.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function canEnterSession(status: string): boolean {
  return (
    status !== "CANCELED_BY_USER" &&
    status !== "CANCELED_BY_COUNSELOR" &&
    status !== "NO_SHOW" &&
    status !== "COMPLETED"
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border last:border-0 pb-2 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground text-right">{children}</span>
    </div>
  );
}
