import Link from "next/link";
import { notFound, redirect } from "next/navigation";
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
import { getClinicalNote } from "@/lib/actions/clinical-notes";
import { NoteEditor } from "./_components/note-editor";

/**
 * Day 17 — 상담사 임상 노트 작성.
 *
 * URL [id] = bookingId. Booking 1:1 Session → ClinicalNote 사슬.
 * 세션이 아직 없으면 "세션 입장 후 노트 작성" 안내.
 */
export default async function ClinicalNotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "COUNSELOR") redirect("/403");

  const { id: bookingId } = await params;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      counselorId: true,
      scheduledAt: true,
      employee: { select: { nickname: true } },
      session: { select: { id: true } },
    },
  });
  if (!booking) notFound();
  if (booking.counselorId !== session.user.id) redirect("/403");

  if (!booking.session) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <Button asChild variant="outline" size="sm" className="w-fit">
          <Link href={`/counselor/cases/${bookingId}`}>← 케이스 상세</Link>
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>세션이 아직 시작되지 않았습니다</CardTitle>
            <CardDescription>
              "세션 입장" 으로 채팅 룸을 한 번 열어야 노트를 작성할 수 있습니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href={`/counselor/cases/${bookingId}`}>케이스 상세로 돌아가기</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const noteResult = await getClinicalNote({ sessionId: booking.session.id });
  if (!noteResult.ok) {
    throw new Error(noteResult.error);
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <Button asChild variant="outline" size="sm" className="w-fit">
        <Link href={`/counselor/cases/${bookingId}`}>← 케이스 상세</Link>
      </Button>

      <header>
        <h1 className="text-2xl font-semibold text-foreground">
          {booking.employee.nickname ?? "이름 없음"} 님 임상 노트
        </h1>
        <p className="text-sm text-muted-foreground">
          SOAP 형식 · {noteResult.note?.status === "FINALIZED" ? "확정" : "초안"} ·
          {" "}
          {booking.scheduledAt.toLocaleString("ko-KR", {
            timeZone: "Asia/Seoul",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })}
        </p>
      </header>

      <NoteEditor sessionId={booking.session.id} initial={noteResult.note} />
    </div>
  );
}
