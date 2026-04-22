"use client";

import { useId, useMemo } from "react";

export type PieSlice = { label: string; value: number; color: string };

export function PieChart({
  data,
  size = 160,
  thickness = 24,
}: {
  data: PieSlice[];
  size?: number;
  thickness?: number;
}) {
  const total = data.reduce((s, d) => s + Math.max(0, d.value), 0);
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - thickness / 2;
  const id = useId();

  if (total <= 0) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="No earnings data">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(15,23,42,0.08)" strokeWidth={thickness} />
        <text x={cx} y={cy + 4} textAnchor="middle" fontSize={12} fill="#94a3b8">
          No data
        </text>
      </svg>
    );
  }

  let offset = 0;
  const circumference = 2 * Math.PI * r;
  const segments = data
    .filter((d) => d.value > 0)
    .map((d, i) => {
      const frac = d.value / total;
      const len = frac * circumference;
      const seg = (
        <circle
          key={`${id}-${i}`}
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={d.color}
          strokeWidth={thickness}
          strokeLinecap="butt"
          strokeDasharray={`${len} ${circumference - len}`}
          strokeDashoffset={-offset}
          style={{ transition: "stroke-dasharray 400ms ease, stroke-dashoffset 400ms ease" }}
        >
          <title>
            {d.label}: {d.value.toFixed(2)} AEC ({(frac * 100).toFixed(1)}%)
          </title>
        </circle>
      );
      offset += len;
      return seg;
    });

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="Earnings breakdown by source"
      style={{ transform: "rotate(-90deg)" }}
    >
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(15,23,42,0.06)" strokeWidth={thickness} />
      {segments}
    </svg>
  );
}

export type StackedSeries = {
  key: string;
  label: string;
  color: string;
  values: number[];
};

export function StackedAreaChart({
  series,
  width = 640,
  height = 160,
  padding = 4,
  ariaLabel = "Stacked earnings over time",
}: {
  series: StackedSeries[];
  width?: number;
  height?: number;
  padding?: number;
  ariaLabel?: string;
}) {
  const len = series[0]?.values.length ?? 0;

  const stacks = useMemo(() => {
    if (len === 0) return [];
    const cum: number[] = new Array(len).fill(0);
    return series.map((s) => {
      const lower = [...cum];
      for (let i = 0; i < len; i++) cum[i] += Math.max(0, s.values[i] ?? 0);
      const upper = [...cum];
      return { ...s, lower, upper };
    });
  }, [series, len]);

  const max = useMemo(() => {
    let m = 0;
    for (let i = 0; i < len; i++) {
      let sum = 0;
      for (const s of series) sum += Math.max(0, s.values[i] ?? 0);
      if (sum > m) m = sum;
    }
    return m || 1;
  }, [series, len]);

  const innerW = width - padding * 2;
  const innerH = height - padding * 2;

  const x = (i: number) => padding + (i / Math.max(1, len - 1)) * innerW;
  const y = (v: number) => padding + innerH - (v / max) * innerH;

  if (len === 0) {
    return (
      <svg width={width} height={height} role="img" aria-label={ariaLabel}>
        <rect x={0} y={0} width={width} height={height} fill="rgba(15,23,42,0.03)" />
      </svg>
    );
  }

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel} preserveAspectRatio="none">
      {stacks.map((s) => {
        const top = s.upper.map((v, i) => `${x(i)},${y(v)}`).join(" ");
        const bot = s.lower
          .map((v, i) => `${x(i)},${y(v)}`)
          .reverse()
          .join(" ");
        return (
          <polygon
            key={s.key}
            points={`${top} ${bot}`}
            fill={s.color}
            fillOpacity={0.85}
            stroke="none"
            style={{ transition: "fill-opacity 200ms ease" }}
          >
            <title>{s.label}</title>
          </polygon>
        );
      })}
    </svg>
  );
}

export function Legend({ items }: { items: Array<{ label: string; color: string; hint?: string }> }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, fontSize: 12 }}>
      {items.map((it) => (
        <div key={it.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            aria-hidden="true"
            style={{
              width: 10,
              height: 10,
              borderRadius: 3,
              background: it.color,
              flexShrink: 0,
            }}
          />
          <span style={{ fontWeight: 700, color: "#334155" }}>{it.label}</span>
          {it.hint ? <span style={{ color: "#94a3b8" }}>· {it.hint}</span> : null}
        </div>
      ))}
    </div>
  );
}
