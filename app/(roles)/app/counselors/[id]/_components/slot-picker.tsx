"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { createBooking } from "@/lib/actions/booking";

interface DayGroup {
  dayLabel: string;
  slots: { scheduledAtISO: string; timeLabel: string }[];
}

export function SlotPicker({
  counselorId,
  days,
}: {
  counselorId: string;
  days: DayGroup[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);

  function book(scheduledAtISO: string) {
    if (pending) return;
    setError(null);
    setPicked(scheduledAtISO);
    startTransition(async () => {
      const r = await createBooking({ counselorId, scheduledAtISO });
      if (r.ok) {
        router.push(`/app/bookings/${r.bookingId}`);
      } else {
        setError(r.error);
        setPicked(null);
      }
    });
  }

  if (days.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        다음 7일 안에 예약 가능한 슬롯이 없습니다.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {days.map((d) => (
        <div key={d.dayLabel}>
          <h3 className="text-sm font-medium text-foreground mb-2">{d.dayLabel}</h3>
          <div className="flex flex-wrap gap-2">
            {d.slots.map((s) => (
              <Button
                key={s.scheduledAtISO}
                size="sm"
                variant={picked === s.scheduledAtISO ? "default" : "outline"}
                disabled={pending}
                onClick={() => book(s.scheduledAtISO)}
              >
                {s.timeLabel}
              </Button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
