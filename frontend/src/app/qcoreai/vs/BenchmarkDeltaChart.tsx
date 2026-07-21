"use client";

import { useState } from "react";
import type { BenchmarkDeltaPoint } from "./data";

// Categorical pair from the AEVION dataviz palette (slots 1 + 2), validated
// via scripts/validate_palette.js — all checks pass (worst adjacent CVD ΔE
// 24.7, normal-vision ΔE 33.6, both well above the ≥8 / ≥15 floors).
const HISTORICAL_COLOR = "#eb6834"; // slot 2 — orange, the fixed baseline
const LATEST_COLOR = "#2a78d6"; // slot 1 — blue, the current run

const CHART_H = 120;
const BAR_W = 20;
const BAR_GAP = 3;
const GROUP_GAP = 22;
const LABEL_H = 28;

function barHeight(pct: number | null): number {
  if (pct === null) return 0;
  return Math.max(2, (pct / 100) * CHART_H);
}

export default function BenchmarkDeltaChart({
  data,
  latestDate,
}: {
  data: BenchmarkDeltaPoint[];
  latestDate?: string | null;
}) {
  const [hover, setHover] = useState<{ category: string; series: "historical" | "latest"; pct: number | null } | null>(null);

  if (data.length === 0) return null;

  const groupW = BAR_W * 2 + BAR_GAP;
  const width = data.length * (groupW + GROUP_GAP) - GROUP_GAP;

  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 10, fontSize: 11, color: "#475569" }}>
        <LegendSwatch color={HISTORICAL_COLOR} label="Historical (curated N=40)" />
        <LegendSwatch color={LATEST_COLOR} label={`Latest run${latestDate ? ` (${latestDate.slice(0, 10)})` : ""}`} />
      </div>

      <svg
        role="img"
        aria-label="Historical vs. latest benchmark win-rate per category"
        viewBox={`0 0 ${width} ${CHART_H + LABEL_H}`}
        width="100%"
        height={CHART_H + LABEL_H}
        style={{ maxWidth: width, display: "block" }}
      >
        {/* baseline */}
        <line x1={0} y1={CHART_H} x2={width} y2={CHART_H} stroke="rgba(15,23,42,0.12)" strokeWidth={1} />

        {data.map((d, i) => {
          const gx = i * (groupW + GROUP_GAP);
          const hH = barHeight(d.historicalPct);
          const lH = barHeight(d.latestPct);
          return (
            <g key={d.category}>
              {/* historical bar */}
              <rect
                x={gx}
                y={CHART_H - hH}
                width={BAR_W}
                height={hH}
                rx={4}
                fill={HISTORICAL_COLOR}
                opacity={hover && hover.category === d.category && hover.series !== "historical" ? 0.35 : 1}
                onMouseEnter={() => setHover({ category: d.category, series: "historical", pct: d.historicalPct })}
                onMouseLeave={() => setHover(null)}
                style={{ cursor: "default" }}
              >
                <title>{`${d.category}: historical ${d.historicalPct}%`}</title>
              </rect>
              <text x={gx + BAR_W / 2} y={CHART_H - hH - 4} textAnchor="middle" fontSize={9} fontWeight={800} fill="#475569">
                {d.historicalPct}
              </text>

              {/* latest bar */}
              {d.latestPct !== null ? (
                <>
                  <rect
                    x={gx + BAR_W + BAR_GAP}
                    y={CHART_H - lH}
                    width={BAR_W}
                    height={lH}
                    rx={4}
                    fill={LATEST_COLOR}
                    opacity={hover && hover.category === d.category && hover.series !== "latest" ? 0.35 : 1}
                    onMouseEnter={() => setHover({ category: d.category, series: "latest", pct: d.latestPct })}
                    onMouseLeave={() => setHover(null)}
                    style={{ cursor: "default" }}
                  >
                    <title>{`${d.category}: latest run ${d.latestPct}%`}</title>
                  </rect>
                  <text x={gx + BAR_W + BAR_GAP + BAR_W / 2} y={CHART_H - lH - 4} textAnchor="middle" fontSize={9} fontWeight={800} fill="#475569">
                    {d.latestPct}
                  </text>
                </>
              ) : (
                <text x={gx + BAR_W + BAR_GAP + BAR_W / 2} y={CHART_H - 4} textAnchor="middle" fontSize={9} fill="#cbd5e1">
                  —
                </text>
              )}

              {/* category label */}
              <text x={gx + groupW / 2} y={CHART_H + 16} textAnchor="middle" fontSize={9.5} fill="#64748b">
                {d.category}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 10, height: 10, borderRadius: 3, background: color, display: "inline-block" }} />
      {label}
    </span>
  );
}
