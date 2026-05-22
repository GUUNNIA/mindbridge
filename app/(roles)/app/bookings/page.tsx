import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * /app/bookings — 직원 본인 예약 목록 (IA 2.2, Day 22 추가).
 *
 * 권한: 미들웨어가 /app/* 를 EMPLOYEE 로 1차 검증. 본인 격리는
 * employeeId === session.user.id 로 쿼리.
 */
export default async function BookingsListPage() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "EMPLOYEE") redirect("/403");

  const bookings = await prisma.booking.findMany({
    where: { employeeId: session.user.id },
    orderBy: { scheduledAt: "desc" },
    take: 50,
    include: {
      counselor: { select: { nickname: true } },
    },
  });

  const upcoming = bookings.filter(
    (b) =>
      b.scheduledAt.getTime() > Date.now() &&
      b.status !== "CANCELED_BY_USER" &&
      b.status !== "CANCELED_BY_COUNSELOR" &&
      b.status !== "NO_SHOW",
  );
  const past = bookings.filter((b) => !upcoming.includes(b));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">내 예약</h1>
        <p className="text-sm text-muted-foreground">
          예정된 상담과 지난 예약을 한눈에 확인할 수 있습니다.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          예정 ({upcoming.length})
        </h2>
        {upcoming.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">
              예정된 예약이 없습니다.
              <Button asChild variant="link" className="px-2">
                <Link href="/app/counselors">상담사 찾기</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {upcoming.map((b) => (
              <BookingCard
                key={b.id}
                id={b.id}
                counselorName={b.counselor.nickname ?? "이름 없음"}
                scheduledAt={b.scheduledAt}
                status={b.status}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          지난·취소 ({past.length})
        </h2>
        {past.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">
              지난 예약 기록이 없습니다.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {past.map((b) => (
              <BookingCard
                key={b.id}
                id={b.id}
                counselorName={b.counselor.nickname ?? "이름 없음"}
                scheduledAt={b.scheduledAt}
                status={b.status}
                muted
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function BookingCard({
  id,
  counselorName,
  scheduledAt,
  status,
  muted = false,
}: {
  id: string;
  counselorName: string;
  scheduledAt: Date;
  status: string;
  muted?: boolean;
}) {
  const label = STATUS_LABEL[status] ?? { label: status, color: "" };
  return (
    <Card className={muted ? "opacity-80" : ""}>
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{counselorName} 상담사</CardTitle>
          <span
            className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${label.color}`}
          >
            {label.label}
          </span>
        </div>
        <CardDescription>{fmtKST(scheduledAt)}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline" size="sm">
          <Link href={`/app/bookings/${id}`}>상세 보기</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  REQUESTED: { label: "예약 요청됨", color: "bg-secondary text-secondary-foreground" },
  CONFIRMED: { label: "확정됨", color: "bg-brand-100 text-brand-700" },
  IN_SESSION: { label: "진행 중", color: "bg-risk-l1 text-foreground" },
  COMPLETED: { label: "완료", color: "bg-muted text-muted-foreground" },
  CANCELED_BY_USER: { label: "취소됨 (본인)", color: "bg-muted text-muted-foreground" },
  CANCELED_BY_COUNSELOR: {
    label: "취소됨 (상담사)",
    color: "bg-muted text-muted-foreground",
  },
  NO_SHOW: { label: "미입장", color: "bg-risk-l2 text-white" },
};

function fmtKST(d: Date): string {
  return d.toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
