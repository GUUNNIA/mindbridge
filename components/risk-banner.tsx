import Link from "next/link";

/**
 * 위기 배너 (Day 19, PRD §8 + US-E4 AC1).
 *
 * L2+ 위기 감지 시 화면 상단 고정으로 핫라인 노출.
 * server/client component 어디서든 사용 가능 (pure presentational).
 */

export type BannerLevel = "L2" | "L3" | "L4";

export function RiskBanner({ level, message }: { level: BannerLevel; message?: string }) {
  const colorByLevel: Record<BannerLevel, string> = {
    L2: "bg-risk-l2 text-white",
    L3: "bg-risk-l3 text-white",
    L4: "bg-risk-l3 text-white animate-pulse",
  };
  const labelByLevel: Record<BannerLevel, string> = {
    L2: "위기 신호 감지",
    L3: "위기 — 전문가 개입 권고",
    L4: "긴급 — 즉시 도움 필요",
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`flex flex-wrap items-center justify-between gap-3 rounded-md px-4 py-3 text-sm ${colorByLevel[level]}`}
    >
      <div className="flex flex-col">
        <strong className="font-semibold">{labelByLevel[level]}</strong>
        <span className="text-xs opacity-90">
          {message ?? "지금 힘드시다면 아래 번호로 즉시 연락해 주세요."}
        </span>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <a href="tel:1393" className="rounded bg-white/20 px-3 py-1 font-medium hover:bg-white/30">
          📞 1393
        </a>
        <a
          href="tel:1577-0199"
          className="rounded bg-white/20 px-3 py-1 font-medium hover:bg-white/30"
        >
          📞 1577-0199
        </a>
        <a href="tel:119" className="rounded bg-white/20 px-3 py-1 font-medium hover:bg-white/30">
          📞 119
        </a>
        <Link
          href="/app/emergency"
          className="rounded bg-white/20 px-3 py-1 font-medium hover:bg-white/30"
        >
          자세히
        </Link>
      </div>
    </div>
  );
}
