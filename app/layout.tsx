import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MindBridge — 정신건강 EAP",
  description: "멀티롤 정신건강 EAP 플랫폼 MVP",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        {process.env.NEXT_PUBLIC_DEMO_BANNER === "true" && (
          <div className="bg-amber-100 border-b border-amber-300 px-4 py-1.5 text-center text-xs text-amber-900">
            DEMO ENVIRONMENT — 가상 데이터 / 실제 의료 서비스 아님
          </div>
        )}
        {children}
      </body>
    </html>
  );
}
