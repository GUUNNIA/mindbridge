import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-semibold">찾으시는 페이지가 없어요</h1>
        <p className="text-neutral-600">URL을 다시 확인해주세요.</p>
        <Link href="/" className="text-brand-600 hover:underline">
          홈으로 돌아가기
        </Link>
      </div>
    </main>
  );
}
