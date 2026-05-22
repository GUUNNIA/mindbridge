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
import { ROLE_HOME } from "@/lib/role-routes";

/**
 * 루트 랜딩 페이지.
 * - 로그인 상태: 본인 role 홈으로 redirect (ROLE_HOME)
 * - 비로그인 상태: 서비스 소개 + 로그인·가입 CTA
 *
 * V1 은 외부 청중용 마케팅 페이지가 아닌 디자인·기능 미리보기 수준. 이미지·일러스트는 V2.
 */

export default async function LandingPage() {
  const session = await getServerSession(authOptions);
  if (session?.user) {
    redirect(ROLE_HOME[session.user.role] ?? "/signin");
  }

  return (
    <main className="min-h-screen bg-muted/40">
      <div className="mx-auto max-w-4xl px-6 pb-12 pt-16 sm:pt-20">
        <Hero />
        <ValueCards />
        <Footer />
      </div>
    </main>
  );
}

function Hero() {
  return (
    <section className="mb-14 text-center">
      <p className="mb-4 inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
        B2B 정신건강 EAP 플랫폼
      </p>
      <h1 className="text-4xl font-semibold leading-tight tracking-tight text-foreground sm:text-[2.75rem]">
        MindBridge
      </h1>
      <p className="mx-auto mt-4 max-w-2xl text-base text-foreground sm:text-lg">
        직원·상담사·전문의·HR·운영자가 한 흐름에서 자연스럽게 협진하는 멀티롤 정신건강 케어 플랫폼.
      </p>
      <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">
        Claude AI 기반 자가진단·임상 노트 자동화·위기 신호 감지와 k-익명성 HR 인사이트를 한 곳에서.
      </p>

      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Button asChild className="px-6">
          <Link href="/signin">로그인</Link>
        </Button>
        <Button asChild variant="outline" className="px-6">
          <Link href="/signup">초대 코드로 가입</Link>
        </Button>
      </div>
    </section>
  );
}

function ValueCards() {
  const items: Array<{
    title: string;
    description: string;
    body: string;
  }> = [
    {
      title: "멀티롤 협진",
      description: "한 케이스, 자연스러운 흐름",
      body:
        "직원의 자가진단부터 상담사 매칭, 전문의 에스컬레이션, HR 익명 집계까지 — 5개 롤이 같은 데이터의 다른 단면을 본인 권한에 맞게 다룹니다.",
    },
    {
      title: "AI 임상 자동화",
      description: "Claude 도구 4종",
      body:
        "카테고리 분류·SOAP 노트 자동 변환·위기 신호 평가·HR 인사이트 생성. 상담사의 행정 시간을 줄이고, 위기는 30초 이내에 감지합니다.",
    },
    {
      title: "익명성·감사성",
      description: "k≥5 가드 + 컬럼 암호화",
      body:
        "HR이 운영하지만 개인 식별은 0건. 임상 데이터는 앱 레이어 AES-256-GCM 암호화, 모든 민감 접근에 감사 로그를 남깁니다.",
    },
  ];

  return (
    <section className="grid gap-4 md:grid-cols-3">
      {items.map((it) => (
        <Card key={it.title} className="h-full">
          <CardHeader className="space-y-1.5 pb-3">
            <CardTitle className="text-base">{it.title}</CardTitle>
            <CardDescription className="text-xs">{it.description}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm leading-relaxed text-muted-foreground">
            {it.body}
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

function Footer() {
  return (
    <footer className="mt-10 border-t border-border pt-5 text-center text-xs text-muted-foreground">
      <p>
        이 환경은 기획→개발 프로세스 검증용 데모입니다. 실제 의료·상담 서비스가 아니며 모든 데이터는 가상입니다.
      </p>
    </footer>
  );
}
