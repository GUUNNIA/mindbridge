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
import { listCounselorCases } from "@/lib/actions/counselor-cases";

const KST = "Asia/Seoul";

function formatKST(d: Date): string {
  return d.toLocaleString("ko-KR", {
    timeZone: KST,
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

const STATUS_LABEL: Record<string, string> = {
  REQUESTED: "요청",
  CONFIRMED: "확정",
  IN_SESSION: "진행",
  COMPLETED: "완료",
  CANCELED_BY_USER: "취소(직원)",
  CANCELED_BY_COUNSELOR: "취소(상담사)",
  NO_SHOW: "미입장",
};

const SEVERITY_LABEL: Record<string, string> = {
  NONE: "없음",
  MILD: "약함",
  MODERATE: "보통",
  MODERATELY_SEVERE: "다소 심함",
  SEVERE: "심각",
};

export default async function CounselorCasesPage() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "COUNSELOR") redirect("/403");

  const cases = await listCounselorCases();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">담당 케이스</h1>
        <p className="text-sm text-muted-foreground">
          {cases.length}건 — 시각순. 직원 진단 요약은 본인 담당 케이스에 한해 표시됩니다.
        </p>
      </header>

      {cases.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>담당 케이스가 없습니다</CardTitle>
            <CardDescription>
              직원이 매칭으로 예약하면 여기에 자동으로 나타납니다.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-3 py-2 font-medium">일시 (KST)</th>
                  <th className="px-3 py-2 font-medium">직원</th>
                  <th className="px-3 py-2 font-medium">예약 상태</th>
                  <th className="px-3 py-2 font-medium">자가진단 요약</th>
                  <th className="px-3 py-2 font-medium">세션</th>
                  <th className="px-3 py-2 font-medium">조치</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => (
                  <tr key={c.bookingId} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 whitespace-nowrap">{formatKST(c.scheduledAt)}</td>
                    <td className="px-3 py-2">{c.employee.nickname ?? "이름 없음"}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {STATUS_LABEL[c.status] ?? c.status}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {c.assessment ? (
                        <>
                          {c.assessment.primaryCategoryName ?? "분류 없음"}
                          {c.assessment.severity && (
                            <span className="ml-1 text-xs">
                              · {SEVERITY_LABEL[c.assessment.severity] ?? c.assessment.severity}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="italic">미완료</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {c.sessionStatus ?? <span className="italic">미생성</span>}
                    </td>
                    <td className="px-3 py-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/counselor/cases/${c.bookingId}`}>상세</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
