import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-muted/40 flex items-center justify-center px-6 py-16">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle className="text-3xl text-brand-700">MindBridge</CardTitle>
          <CardDescription>
            정신건강 EAP 멀티롤 플랫폼 MVP — 기획→개발 프로세스 검증 프로젝트
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Week 1 Day 1 — Tailwind + shadcn 토큰 연결 확인용 화면. 실제 라우팅은 Day 2 NextAuth
            셋업 이후 활성화됩니다.
          </p>
          <p className="text-xs">
            아래 두 버튼은 토큰이 의도대로 적용됐는지 보기 위한 더미입니다. 동작 없음.
          </p>
        </CardContent>
        <CardFooter className="gap-2">
          <Button>시작</Button>
          <Button variant="outline">진행 상황</Button>
        </CardFooter>
      </Card>
    </main>
  );
}
