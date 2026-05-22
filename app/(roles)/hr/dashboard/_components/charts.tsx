"use client";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

/**
 * HR 대시보드 차트 (D23) — recharts 기반 client 컴포넌트.
 *
 * k=5 마스킹 처리:
 *   - 시계열: 마스킹 셀은 0 으로 그리되 tooltip 에 "<5명" 명시
 *   - 카테고리/부서: 마스킹 셀은 회색 + 라벨 "<5명"
 *
 * 색상: shadcn brand 토큰 (CSS 변수) 대신 안전한 hex —
 *   recharts 가 CSS 변수 직접 지원이 미흡해 직접 hex 지정. 추후 토큰화 V2.
 */

const COLOR_PRIMARY = "#0d9488"; // teal-600 (brand 톤)
const COLOR_MASKED = "#cbd5e1"; // slate-300
const COLOR_GRID = "#e2e8f0"; // slate-200
const COLOR_TICK = "#64748b"; // slate-500

// ============================================================
// 추이 차트 (월별)
// ============================================================
export interface MonthlySeriesPointView {
  monthKey: string;
  monthLabel: string;
  value: number;
  masked: boolean;
}

export function MonthlyTrendChart({
  data,
  ariaLabel,
}: {
  data: MonthlySeriesPointView[];
  ariaLabel: string;
}) {
  return (
    <div role="img" aria-label={ariaLabel} className="h-56 w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 12, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid stroke={COLOR_GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="monthLabel"
            stroke={COLOR_TICK}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: COLOR_GRID }}
          />
          <YAxis
            stroke={COLOR_TICK}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload || payload.length === 0) return null;
              const p = payload[0].payload as MonthlySeriesPointView;
              return (
                <div className="rounded-md border border-border bg-background px-3 py-2 text-xs shadow-sm">
                  <p className="font-medium">{p.monthLabel}</p>
                  <p className="text-muted-foreground">
                    {p.masked ? "<5명 (마스킹)" : `${p.value}회`}
                  </p>
                </div>
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={COLOR_PRIMARY}
            strokeWidth={2}
            dot={{ r: 3, fill: COLOR_PRIMARY }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ============================================================
// 가로 막대 차트 (카테고리 / 부서별 공용)
// ============================================================
export interface HorizontalBarRow {
  label: string;
  value: number;
  masked: boolean;
  /** 표시용 보조 (예: "17명 중") */
  subLabel?: string;
}

export function HorizontalBarChart({
  data,
  unit,
  ariaLabel,
}: {
  data: HorizontalBarRow[];
  unit: string;
  ariaLabel: string;
}) {
  if (data.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        표시할 데이터가 없습니다.
      </p>
    );
  }
  // 마스킹 셀은 차트에서 0 으로 보이지 않도록 1 로 채우되, 색을 회색으로 (외형 일관성)
  const view = data.map((d) => ({
    ...d,
    displayValue: d.masked ? 0 : d.value,
  }));

  const height = Math.max(120, view.length * 36);

  return (
    <div role="img" aria-label={ariaLabel} style={{ height }} className="w-full">
      <ResponsiveContainer>
        <BarChart
          data={view}
          layout="vertical"
          margin={{ top: 4, right: 24, left: 0, bottom: 0 }}
        >
          <CartesianGrid stroke={COLOR_GRID} strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            stroke={COLOR_TICK}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: COLOR_GRID }}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            stroke={COLOR_TICK}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={80}
          />
          <Tooltip
            cursor={{ fill: "rgba(13, 148, 136, 0.06)" }}
            content={({ active, payload }) => {
              if (!active || !payload || payload.length === 0) return null;
              const p = payload[0].payload as HorizontalBarRow & {
                displayValue: number;
              };
              return (
                <div className="rounded-md border border-border bg-background px-3 py-2 text-xs shadow-sm">
                  <p className="font-medium">
                    {p.label}
                    {p.subLabel ? <span className="ml-2 text-muted-foreground">({p.subLabel})</span> : null}
                  </p>
                  <p className="text-muted-foreground">
                    {p.masked ? "<5명 (마스킹)" : `${p.value}${unit}`}
                  </p>
                </div>
              );
            }}
          />
          <Bar dataKey="displayValue" radius={[0, 4, 4, 0]}>
            {view.map((row, idx) => (
              <Cell
                key={idx}
                fill={row.masked ? COLOR_MASKED : COLOR_PRIMARY}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
