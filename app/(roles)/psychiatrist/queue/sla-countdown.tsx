"use client";

import { useEffect, useState } from "react";

/**
 * SLA 카운트다운 (D20). 클라이언트 1초 갱신.
 *
 * 색상 임계:
 *   - 60분 초과: muted
 *   - 60분 이내: 주황 (warning)
 *   - 15분 이내: 빨강 (critical)
 *   - 만료(0 이하): 빨강 + "SLA 만료" 표시. EXPIRED 전이는 cron 이 처리하므로 화면은 안내만.
 */
export function SlaCountdown({
  slaDueAt,
  status,
}: {
  slaDueAt: string; // ISO
  status: "PENDING" | "IN_REVIEW" | "DECIDED" | "EXPIRED";
}) {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    if (status === "DECIDED" || status === "EXPIRED") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [status]);

  if (status === "DECIDED") {
    return <span className="text-xs text-muted-foreground">사인오프 완료</span>;
  }
  if (status === "EXPIRED") {
    return <span className="text-xs font-medium text-red-700">SLA 만료</span>;
  }

  const due = new Date(slaDueAt).getTime();
  const remainingMs = due - now;
  const isExpired = remainingMs <= 0;

  if (isExpired) {
    return (
      <span className="text-xs font-medium text-red-700">
        SLA 만료 (cron 대기)
      </span>
    );
  }

  const totalSec = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  let cls = "text-muted-foreground";
  if (remainingMs <= 15 * 60 * 1000) cls = "text-red-700 font-medium";
  else if (remainingMs <= 60 * 60 * 1000) cls = "text-amber-700 font-medium";

  const text =
    hours > 0
      ? `${hours}시간 ${String(minutes).padStart(2, "0")}분`
      : `${minutes}분 ${String(seconds).padStart(2, "0")}초`;

  return <span className={`text-xs ${cls}`}>SLA 잔여 {text}</span>;
}
