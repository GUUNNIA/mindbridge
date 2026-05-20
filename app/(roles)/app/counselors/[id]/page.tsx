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
import { guardOnboarded } from "@/lib/onboarding";
import { listCounselorSlots } from "@/lib/actions/booking";
import { SlotPicker } from "./_components/slot-picker";

const TIER_LABEL: Record<string, string> = {
  JUNIOR: "주니어",
  SENIOR: "시니어",
  SUPERVISOR: "수퍼바이저",
};

const KST = "Asia/Seoul";

function formatDayKST(d: Date): string {
  return d.toLocaleDateString("ko-KR", {
    timeZone: KST,
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

function formatTimeKST(d: Date): string {
  return d.toLocaleTimeString("ko-KR", {
    timeZone: KST,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function dayKeyKST(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: KST }); // YYYY-MM-DD
}

export default async function CounselorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "EMPLOYEE") redirect("/403");
  await guardOnboarded(session.user.id);

  const { id } = await params;

  const counselor = await prisma.counselor.findUnique({
    where: { id },
    include: {
      user: { select: { nickname: true } },
      categories: { include: { category: true } },
    },
  });
  if (!counselor) notFound();

  const { slots } = await listCounselorSlots({ counselorId: id });

  // 날짜별 KST 기준 그룹화 (UI 표시용)
  const groups = new Map<string, { date: Date; slots: { scheduledAtISO: string; timeLabel: string }[] }>();
  for (const s of slots) {
    const d = new Date(s.scheduledAt);
    const key = dayKeyKST(d);
    const entry = groups.get(key) ?? { date: d, slots: [] };
    entry.slots.push({ scheduledAtISO: s.scheduledAt, timeLabel: formatTimeKST(d) });
    groups.set(key, entry);
  }
  const days = [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => ({
      dayLabel: formatDayKST(v.date),
      slots: v.slots.sort((a, b) => a.scheduledAtISO.localeCompare(b.scheduledAtISO)),
    }));

  return (
    <div className="space-y-4">
      <Button asChild variant="outline" size="sm" className="w-fit">
        <Link href="/app/counselors">← 추천 목록으로</Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{counselor.user.nickname ?? "이름 없음"}</CardTitle>
          <CardDescription>
            {TIER_LABEL[counselor.tier] ?? counselor.tier} · {counselor.yearsOfPractice}년차
            {counselor.rating != null && ` · ★ ${counselor.rating.toFixed(1)} (${counselor.ratingCount})`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {counselor.bio && <p className="text-foreground">{counselor.bio}</p>}
          {counselor.categories.length > 0 && (
            <p className="text-muted-foreground">
              전문 분야:{" "}
              {counselor.categories.map((c) => c.category.name).join(", ")}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">예약 가능 시각 (다음 7일, KST)</CardTitle>
          <CardDescription>슬롯을 선택하면 예약이 즉시 요청됩니다 (REQUESTED).</CardDescription>
        </CardHeader>
        <CardContent>
          <SlotPicker counselorId={counselor.id} days={days} />
        </CardContent>
      </Card>
    </div>
  );
}
