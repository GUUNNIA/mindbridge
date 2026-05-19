"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Sentry는 Day 7부터 연결. 그 전까지는 콘솔 출력.
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center space-y-4 max-w-md">
        <h1 className="text-2xl font-semibold">일시적 오류가 발생했어요</h1>
        <p className="text-neutral-600">잠시 후 다시 시도해주세요.</p>
        {error.digest && (
          <p className="text-xs text-neutral-400 font-mono">trace: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="rounded-md bg-brand-600 px-4 py-2 text-white hover:bg-brand-700"
        >
          재시도
        </button>
      </div>
    </main>
  );
}
