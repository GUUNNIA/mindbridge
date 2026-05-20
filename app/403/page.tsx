import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = {
  title: "접근 권한이 없습니다 | MindBridge",
};

export default function ForbiddenPage() {
  return (
    <main className="min-h-screen bg-muted/40 flex items-center justify-center px-6 py-16">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-destructive">접근 권한이 없습니다</CardTitle>
          <CardDescription>
            이 페이지는 다른 역할의 사용자만 열람할 수 있어요.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>잘못 들어오신 경우 로그아웃 후 올바른 계정으로 다시 로그인해 주세요.</p>
        </CardContent>
        <CardFooter className="gap-2">
          <Button asChild variant="outline">
            <Link href="/">처음으로</Link>
          </Button>
          <Button asChild>
            <Link href="/signin">로그인</Link>
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}
