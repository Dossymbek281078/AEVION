"use client";

import { useCallback, useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiBase";

type TrendPoint = { type: string; week: string; avg: number; count: number };
type TrendsResponse = { ok: boolean; trends: Record<string, TrendPoint[]> };

interface Props {
  refreshKey?: number;
}

const TYPE_LABELS: Record<string, string> = {
  blood_pressure: "Blood Pressure",
  weight_kg:      "Weight",
  sleep_hours:    "Sleep",
  vo2max:         "VO2 Max",
  hrv:            "HRV",
  glucose:        "Glucose",
  stress_level:   "Stress",
};

const TYPE_UNITS: Record<string, string> = {
  blood_pressure: "mmHg",
  weight_kg:      "kg",
  sleep_hours:    "h",
  vo2max:         "ml/kg/min",
  hrv:            "ms",
  glucose:        "mg/dL",
  stress_level:   "/10",
};

// For each type, lower-is-better or higher-is-better — controls trend color.
const HIGHER_IS_BETTER: Record<string, boolean> = {
  vo2max: true,
  hrv: true,
  sleep_hours: true,
};

function trendDir(points: TrendPoint[]): "up" | "down" | "flat" {
  if (points.length < 2) return "flat";
  const first = points[points.length - 1].avg;
  const last = points[0].avg;
  if (last > first * 1.02) return "up";
  if (last < first * 0.98) return "down";
  return "flat";
}

function trendColor(type: string, dir: "up" | "down" | "flat"): string {
  if (dir === "flat") return "#94a3b8";
  const higherIsBetter = HIGHER_IS_BETTER[type] ?? false;
  const isGood = (dir === "up" && higherIsBetter) || (dir === "down" && !higherIsBetter);
  return isGood ? "#34d399" : "#f87171";
}

function Sparkline({ points, color }: { points: TrendPoint[]; color: string }) {
  if (points.length === 0) return null;
  // Points come in DESC week order — reverse for left-to-right time
  const sorted = [...points].reverse();
  const w = 240, h = 60, pad = 6;
  const values = sorted.map(p => p.avg);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = (w - pad * 2) / Math.max(1, sorted.length - 1);
  const coords = sorted.map((p, i) => ({
    x: pad + i * stepX,
    y: pad + (h - pad * 2) * (1 - (p.avg - min) / range),
    avg: p.avg,
    week: p.week,
  }));
  const pathD = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");
  const areaD = `${pathD} L ${coords[coords.length - 1].x.toFixed(1)} ${h - pad} L ${coords[0].x.toFixed(1)} ${h - pad} Z`;
  return (
    <svg width={w} height={h} style={{ display: "block", width: "100%", height: "auto", maxWidth: w }}>
      <defs>
        <linearGradient id={`grad-${color.slice(1)}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#grad-${color.slice(1)})`} />
      <path d={pathD} stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {coords.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r={i === coords.length - 1 ? 3 : 1.8} fill={color}>
          <title>{`Week of ${c.week}: ${c.avg}`}</title>
        </circle>
      ))}
    </svg>
  );
}

export default function WeeklyTrendsChart({ refreshKey }: Props) {
  const [trends, setTrends] = useState<Record<string, TrendPoint[]>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(apiUrl("/api/qlife/biomarkers/trends"), { cache: "no-store" });
      const d: TrendsResponse = await r.json();
      if (d.ok) setTrends(d.trends ?? {});
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load, refreshKey]);

  const types = Object.keys(trends);

  return (
    <div style={styles.card}>
      <div style={styles.headerRow}>
        <h3 style={styles.title}>Weekly Trends</h3>
        <span style={styles.subtitle}>8-week rolling averages</span>
      </div>
      {loading ? (
        <p style={styles.dim}>Loading trends…</p>
      ) : types.length === 0 ? (
        <p style={styles.dim}>No trend data yet — log at least one biomarker.</p>
      ) : (
        <div style={styles.grid}>
          {types.map((type) => {
            const points = trends[type];
            const dir = trendDir(points);
            const color = trendColor(type, dir);
            const latest = points[0];
            const oldest = points[points.length - 1];
            const deltaPct = oldest.avg !== 0 ? ((latest.avg - oldest.avg) / oldest.avg) * 100 : 0;
            return (
              <div key={type} style={styles.typeBlock}>
                <div style={styles.typeHeader}>
                  <div>
                    <div style={styles.typeName}>{TYPE_LABELS[type] ?? type}</div>
                    <div style={styles.typeMeta}>
                      <span style={{ color, fontWeight: 700 }}>
                        {latest.avg} {TYPE_UNITS[type] ?? ""}
                      </span>
                      {points.length >= 2 && (
                        <span style={{ ...styles.deltaPill, background: `${color}22`, color }}>
                          {deltaPct >= 0 ? "+" : ""}{deltaPct.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>
                  <span style={styles.weekCount}>{points.length}w</span>
                </div>
                <Sparkline points={points} color={color} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: "rgba(15,23,42,0.5)",
    border: "1px solid rgba(16,185,129,0.15)",
    borderRadius: 16,
    padding: 20,
  },
  headerRow: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 14,
    gap: 12,
    flexWrap: "wrap",
  },
  title: {
    color: "#f1f5f9",
    fontSize: 18,
    fontWeight: 700,
    margin: 0,
  },
  subtitle: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  dim: {
    color: "#64748b",
    fontSize: 14,
    textAlign: "center",
    padding: "24px 0",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
  },
  typeBlock: {
    background: "rgba(2,8,23,0.5)",
    border: "1px solid #1e293b",
    borderRadius: 12,
    padding: 12,
  },
  typeHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "start",
    marginBottom: 8,
  },
  typeName: {
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: 4,
  },
  typeMeta: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  deltaPill: {
    fontSize: 10,
    padding: "1px 6px",
    borderRadius: 8,
    fontFamily: "monospace",
    fontWeight: 700,
  },
  weekCount: {
    color: "#64748b",
    fontSize: 10,
    fontFamily: "monospace",
    fontWeight: 700,
  },
};
