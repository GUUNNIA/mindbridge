"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { revokeInviteCode } from "@/lib/actions/invites";

export function RevokeButton({ id, code }: { id: string; code: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!confirm(`초대코드 ${code} 을(를) 폐기하시겠습니까?`)) return;
    startTransition(async () => {
      const result = await revokeInviteCode({ id });
      if (!result.ok) {
        alert(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Button type="button" size="sm" variant="outline" onClick={onClick} disabled={pending}>
      {pending ? "폐기 중…" : "폐기"}
    </Button>
  );
}
