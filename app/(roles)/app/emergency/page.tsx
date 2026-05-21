import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Day 19 — 위기 핫라인 페이지 (PUBLIC).
 * middleware PUBLIC_PATHS 에 등록됨 (W1 D2). 로그인 여부 무관 접근.
 * PRD §3.2.1 US-E4 AC3.
 */

export const metadata = {
  title: "위기 핫라인 | MindBridge",
};

const HOTLINES: { name: string; number: string; tel: string; desc: string }[] = [
  {
    name: "자살예방상담전화",
    number: "1393",
    tel: "1393",
    desc: "24시간 무료 · 익명 상담. 자살·자해 위기 즉시 통화 가능",
  },
  {
    name: "정신건강복지센터 상담전화",
    number: "1577-0199",
    tel: "1577-0199",
    desc: "24시간 무료. 위기·우울·불안 즉시 상담",
  },
  {
    name: "응급의료 (119)",
    number: "119",
    tel: "119",
    desc: "즉각적 생명 위협 시 신고. 자해·자살 시도·약물 과량 복용",
  },
];

export default function EmergencyPage() {
  return (
    <main className="min-h-screen bg-muted/40 px-4 py-10">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold text-risk-l3">위기 상황 핫라인</h1>
          <p className="text-sm text-muted-foreground">
            지금 자해·자살 생각이 들거나 위협을 느끼신다면, 아래 번호로 즉시 연락해 주세요.
            모든 통화는 무료이며 익명 보장됩니다.
          </p>
        </header>

        <div className="space-y-3">
          {HOTLINES.map((h) => (
            <Card key={h.number} className="border-risk-l3/30">
              <CardHeader>
                <CardTitle className="flex items-baseline justify-between">
                  <span className="text-xl">{h.name}</span>
                  <a
                    href={`tel:${h.tel}`}
                    className="rounded-md bg-risk-l3 px-4 py-1 text-lg font-bold text-white hover:opacity-90"
                  >
                    📞 {h.number}
                  </a>
                </CardTitle>
                <CardDescription>{h.desc}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>

        <Card className="border-brand-200 bg-brand-50">
          <CardHeader>
            <CardTitle className="text-base text-brand-700">대화·문자 상담</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-foreground">
            <p>
              <strong>카카오톡 — 자살예방상담전화</strong>: 카톡 채널에서 "자살예방상담전화" 검색
            </p>
            <p>
              <strong>온라인 사이트</strong>:{" "}
              <a
                href="https://www.lifeline.or.kr"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-700 underline"
              >
                생명의전화 lifeline.or.kr
              </a>
            </p>
          </CardContent>
        </Card>

        <div className="flex justify-center">
          <Button asChild variant="outline">
            <Link href="/app">← 홈으로</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
