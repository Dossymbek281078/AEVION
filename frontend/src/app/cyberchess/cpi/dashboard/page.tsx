"use client";

// AEVION CPI Dashboard — F4
// Reads localStorage cpi state and renders SVG charts.
// Зона: aevion-core/main owns frontend/src/app/cyberchess/**

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

// TODO: Re-export from ../../cpi.ts once available — agent race condition (F3 parallel)
type CPIBreakdown = {
  E: number; T: number; O: number;
  B1: number; B2: number; B3: number;
  M1: number; M2: number; M3: number;
  H: number; Br: number;
  result: "w" | "l" | "d";
};
type CPIHistoryEntry = {
  date: string;
  delta: number;
  gameId?: string;
  breakdown: CPIBreakdown;
  result?: "w" | "l" | "d";
};
type CPIState = {
  v: 1;
  cpi: number;
  history: CPIHistoryEntry[];
};

function ldCPIState(): CPIState {
  try {
    const r = JSON.parse(localStorage.getItem("aevion_cyberchess_cpi_v1") || "");
    if (r && r.v === 1 && typeof r.cpi === "number" && Array.isArray(r.history)) return r;
  } catch {}
  return { v: 1, cpi: 1200, history: [] };
}

const C = {
  bg: "#0f172a",
  panel: "#1e293b",
  border: "#334155",
  text: "#f1f5f9",
  dim: "#94a3b8",
  faint: "#64748b",
  purple: "#a78bfa",
  green: "#34d399",
  red: "#ef4444",
  yellow: "#fbbf24",
  cyan: "#22d3ee",
  gold: "#f59e0b",
  blue: "#3b82f6",
  gray: "#6b7280",
};

type FactorCode = "E" | "T" | "O" | "B1" | "B2" | "B3" | "M1" | "M2" | "M3" | "H" | "Br";

const FACTOR_META: Array<{ code: FactorCode; name: string; emoji: string; sign: 1 | -1 }> = [
  { code: "E",  name: "Eval-loss",     emoji: "🎯", sign: 1 },
  { code: "T",  name: "Time-mgmt",     emoji: "⏱",  sign: 1 },
  { code: "O",  name: "Opening book",  emoji: "📖", sign: 1 },
  { code: "B1", name: "Best line",     emoji: "①",  sign: 1 },
  { code: "B2", name: "Second line",   emoji: "②",  sign: 1 },
  { code: "B3", name: "Third line",    emoji: "③",  sign: 1 },
  { code: "M1", name: "Mate-in-1",     emoji: "💀", sign: 1 },
  { code: "M2", name: "Mate-in-2",     emoji: "💀", sign: 1 },
  { code: "M3", name: "Mate-in-3",     emoji: "💀", sign: 1 },
  { code: "H",  name: "Hangs",         emoji: "💥", sign: -1 },
  { code: "Br", name: "Brilliancies",  emoji: "💎", sign: 1 },
];

function cpiTier(cpi: number): { label: string; color: string } {
  if (cpi < 800)  return { label: "Beginner",  color: C.gray };
  if (cpi < 1200) return { label: "Novice",    color: C.blue };
  if (cpi < 1800) return { label: "Club",      color: C.green };
  if (cpi < 2400) return { label: "Expert",    color: C.purple };
  return                 { label: "Master",    color: C.gold };
}

function fideEquivalent(cpi: number): number {
  // Rough mapping: CPI / 1.1 (CPI is uplift-friendly, FIDE is harsher)
  return Math.round(cpi / 1.1);
}

// SVG history line chart
function HistoryChart({ history }: { history: CPIHistoryEntry[] }) {
  const W = 760;
  const H = 220;
  const PAD_L = 44;
  const PAD_R = 16;
  const PAD_T = 16;
  const PAD_B = 28;
  const last30 = history.slice(-30);
  if (last30.length === 0) return null;
  // Reconstruct cumulative CPI series back from current cpi
  // We need per-step CPI; if state only stores delta, accumulate from a base.
  // Best signal: assume current cpi is sum of all deltas + 1200 base.
  let running = 1200;
  const series: Array<{ i: number; cpi: number; date: string; delta: number }> = [];
  for (let i = 0; i < history.length; i++) {
    running = Math.max(0, Math.min(4000, running + (history[i]?.delta ?? 0)));
    if (i >= history.length - 30) {
      series.push({ i: series.length, cpi: running, date: history[i]?.date ?? "", delta: history[i]?.delta ?? 0 });
    }
  }
  const ys = series.map((s) => s.cpi);
  const yMin = Math.max(0, Math.min(...ys) - 50);
  const yMax = Math.min(4000, Math.max(...ys) + 50);
  const yRange = Math.max(1, yMax - yMin);
  const xStep = series.length > 1 ? (W - PAD_L - PAD_R) / (series.length - 1) : 0;
  const points = series.map((s, idx) => {
    const x = PAD_L + idx * xStep;
    const y = PAD_T + (H - PAD_T - PAD_B) * (1 - (s.cpi - yMin) / yRange);
    return { x, y, ...s };
  });
  const path = points.map((p, idx) => `${idx === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${path} L${points[points.length - 1].x.toFixed(1)},${H - PAD_B} L${points[0].x.toFixed(1)},${H - PAD_B} Z`;
  const yTicks = [yMin, yMin + yRange * 0.25, yMin + yRange * 0.5, yMin + yRange * 0.75, yMax].map(Math.round);
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }} role="img" aria-label="CPI history chart">
      <defs>
        <linearGradient id="cpiGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.purple} stopOpacity="0.35" />
          <stop offset="100%" stopColor={C.purple} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Y grid */}
      {yTicks.map((t, idx) => {
        const y = PAD_T + (H - PAD_T - PAD_B) * (1 - (t - yMin) / yRange);
        return (
          <g key={idx}>
            <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke={C.border} strokeWidth="1" strokeDasharray="2 4" opacity="0.5" />
            <text x={PAD_L - 6} y={y + 4} fontSize="10" fill={C.faint} textAnchor="end" fontFamily="ui-monospace, monospace">{t}</text>
          </g>
        );
      })}
      {/* Area + line */}
      <path d={areaPath} fill="url(#cpiGrad)" />
      <path d={path} fill="none" stroke={C.purple} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {/* Dots with title tooltip */}
      {points.map((p, idx) => {
        const win = p.delta > 0;
        const dotColor = win ? C.green : p.delta < 0 ? C.red : C.faint;
        return (
          <g key={idx}>
            <circle cx={p.x} cy={p.y} r="3" fill={dotColor} stroke={C.bg} strokeWidth="1.5">
              <title>{`${p.date.slice(0, 10)} · CPI ${p.cpi} · Δ${p.delta > 0 ? "+" : ""}${p.delta}`}</title>
            </circle>
          </g>
        );
      })}
      {/* X labels: first / mid / last */}
      {points.length > 0 && (
        <>
          <text x={points[0].x} y={H - 8} fontSize="10" fill={C.faint} textAnchor="start">{points[0].date.slice(5, 10)}</text>
          {points.length > 2 && (
            <text x={points[Math.floor(points.length / 2)].x} y={H - 8} fontSize="10" fill={C.faint} textAnchor="middle">
              {points[Math.floor(points.length / 2)].date.slice(5, 10)}
            </text>
          )}
          <text x={points[points.length - 1].x} y={H - 8} fontSize="10" fill={C.faint} textAnchor="end">
            {points[points.length - 1].date.slice(5, 10)}
          </text>
        </>
      )}
    </svg>
  );
}

// Mini sparkline per factor
function Sparkline({ values, color }: { values: number[]; color: string }) {
  const W = 100;
  const H = 28;
  if (values.length === 0) return <div style={{ fontSize: 10, color: C.faint }}>—</div>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(0.0001, max - min);
  const xStep = values.length > 1 ? W / (values.length - 1) : 0;
  const pts = values.map((v, i) => {
    const x = i * xStep;
    const y = H - 2 - (H - 4) * ((v - min) / range);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const last = values[values.length - 1];
  const first = values[0];
  const trendUp = last > first;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }} aria-hidden>
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={(values.length - 1) * xStep} cy={H - 2 - (H - 4) * ((last - min) / range)} r="2" fill={trendUp ? C.green : last < first ? C.red : C.faint} />
    </svg>
  );
}

// Bar for last-game breakdown
function FactorBar({ code, name, emoji, contribution, raw, signNeg }: { code: string; name: string; emoji: string; contribution: number; raw: number; signNeg: boolean }) {
  const max = 35; // ~ max possible single-factor contribution
  const pct = Math.min(100, (Math.abs(contribution) / max) * 100);
  const pos = contribution > 0;
  const zero = contribution === 0;
  const barColor = pos ? C.green : zero ? C.faint : C.red;
  return (
    <div title={`${name} (${code}) · raw=${raw.toFixed(2)} · contribution=${pos ? "+" : ""}${contribution.toFixed(1)}`}
         style={{ display: "grid", gridTemplateColumns: "92px 1fr 64px", alignItems: "center", gap: 8, padding: "4px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.dim }}>
        <span style={{ fontSize: 13 }}>{emoji}</span>
        <span style={{ fontWeight: 700, color: C.text }}>{code}</span>
        <span style={{ fontSize: 10, color: C.faint }}>{signNeg ? "−" : "+"}</span>
      </div>
      <div style={{ position: "relative", height: 14, background: "rgba(255,255,255,0.04)", borderRadius: 4, overflow: "hidden" }}>
        <div style={{
          position: "absolute",
          left: pos || zero ? 0 : `${100 - pct}%`,
          width: `${pct}%`,
          top: 0, bottom: 0,
          background: barColor,
          opacity: 0.85,
          borderRadius: 3,
        }} />
      </div>
      <div style={{ fontSize: 11, color: barColor, fontFamily: "ui-monospace, monospace", textAlign: "right", fontWeight: 700 }}>
        {contribution > 0 ? "+" : ""}{contribution.toFixed(1)}
      </div>
    </div>
  );
}

// Approximate per-factor weighted contribution (uses same weights as CPI spec)
const WEIGHTS: Record<FactorCode, number> = {
  E: 30, T: 5, O: 10,
  B1: 20, B2: 5, B3: 2,
  M1: 8, M2: 15, M3: 20,
  H: -25, Br: 30,
};

function contribution(code: FactorCode, raw: number): number {
  const w = WEIGHTS[code] ?? 0;
  return w * raw;
}

function readFactor(bd: CPIBreakdown | undefined, code: FactorCode): number {
  if (!bd) return 0;
  const v = bd[code];
  return typeof v === "number" ? v : 0;
}

export default function CPIDashboardPage() {
  const [state, setState] = useState<CPIState | null>(null);

  useEffect(() => {
    setState(ldCPIState());
  }, []);

  // SSR fallback — render skeleton until client mount
  const isEmpty = !state || (state.cpi === 1200 && state.history.length === 0);

  const tier = state ? cpiTier(state.cpi) : cpiTier(1200);
  const fide = state ? fideEquivalent(state.cpi) : 0;
  const lastGame = state && state.history.length > 0 ? state.history[state.history.length - 1] : null;

  // Per-factor history series (last 10)
  const perFactorSeries = useMemo(() => {
    if (!state) return {} as Record<string, number[]>;
    const last10 = state.history.slice(-10);
    const out: Record<string, number[]> = {};
    for (const meta of FACTOR_META) {
      out[meta.code] = last10.map((h) => readFactor(h.breakdown, meta.code));
    }
    return out;
  }, [state]);

  // Weakest factor over last 10 games (lowest average contribution; for H lowest = most negative)
  const weakest = useMemo(() => {
    if (!state || state.history.length === 0) return null;
    const last10 = state.history.slice(-10);
    let worst: { code: FactorCode; name: string; avg: number } | null = null;
    for (const meta of FACTOR_META) {
      const vals = last10.map((h) => contribution(meta.code, readFactor(h.breakdown, meta.code)));
      if (vals.length === 0) continue;
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      if (worst === null || avg < worst.avg) worst = { code: meta.code, name: meta.name, avg };
    }
    return worst;
  }, [state]);

  return (
    <main style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "system-ui, sans-serif", padding: "32px 16px" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "WebPage",
        "@id": "https://aevion.app/cyberchess/cpi/dashboard",
        name: "AEVION CyberChess CPI Dashboard",
        description: "Персональный дашборд Chess Performance Index — history graph, factor breakdown, weak-zone callout. Уникальный рейтинг качества игры.",
        isPartOf: { "@type": "WebSite", url: "https://aevion.app", name: "AEVION" },
        about: { "@type": "Thing", name: "Chess rating analytics" },
      }) }} />
      <style>{`
        @media (max-width: 640px) {
          h1 { font-size: 22px !important; }
          h2 { font-size: 16px !important; }
          button, a[role="button"] { min-height: 44px; }
          table { font-size: 11px; }
          pre { font-size: 11px !important; }
        }
      `}</style>
      <article style={{ maxWidth: 980, margin: "0 auto" }}>
        {/* Breadcrumb */}
        <div style={{ fontSize: 12, color: C.faint, marginBottom: 16 }}>
          <Link href="/cyberchess" style={{ color: C.dim, textDecoration: "none" }}>CyberChess</Link>
          {" / "}<Link href="/cyberchess/cpi" style={{ color: C.dim, textDecoration: "none" }}>CPI</Link>
          {" / "}<span style={{ color: C.text }}>Dashboard</span>
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.purple, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>
            F4 · CPI Dashboard
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.025em", margin: "0 0 8px", lineHeight: 1.15 }}>
            Твой <span style={{ color: C.purple }}>CPI</span> и тренд качества игры
          </h1>
          <p style={{ fontSize: 14, color: C.dim, margin: 0 }}>
            История 30 партий · разложение по 11 факторам · слабая зона для тренировки
          </p>
        </div>

        {isEmpty ? (
          /* EMPTY STATE */
          <section style={{
            background: C.panel,
            border: `1px dashed ${C.border}`,
            borderRadius: 14,
            padding: "48px 24px",
            textAlign: "center",
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>♟</div>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 8px", color: C.text }}>Ещё нет партий</h2>
            <p style={{ fontSize: 14, color: C.dim, margin: "0 0 24px", lineHeight: 1.6 }}>
              Сыграй первую партию чтобы увидеть свой CPI, разложение по 11 факторам и тренд за 30 партий.
            </p>
            <Link href="/cyberchess" style={{
              display: "inline-block",
              background: C.purple,
              color: "#0f172a",
              padding: "10px 22px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 800,
              textDecoration: "none",
              letterSpacing: 0.3,
            }}>
              Играть → /cyberchess
            </Link>
            <div style={{ marginTop: 24, fontSize: 11, color: C.faint }}>
              <Link href="/cyberchess/cpi" style={{ color: C.purple, textDecoration: "none" }}>← Что такое CPI?</Link>
            </div>
          </section>
        ) : (
          <>
            {/* Hero: current CPI */}
            <section style={{
              background: C.panel,
              border: `1px solid ${C.border}`,
              borderLeft: `4px solid ${tier.color}`,
              borderRadius: 14,
              padding: "24px 28px",
              marginBottom: 20,
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 24,
              alignItems: "center",
            }}>
              <div>
                <div style={{ fontSize: 11, color: C.faint, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 }}>Current CPI</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 72, fontWeight: 900, color: tier.color, fontFamily: "ui-monospace, monospace", lineHeight: 1 }}>
                    {state!.cpi}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: tier.color, textTransform: "uppercase", letterSpacing: 0.8 }}>{tier.label}</div>
                    <div style={{ fontSize: 11, color: C.faint, marginTop: 4 }}>{state!.history.length} {state!.history.length === 1 ? "партия" : "партий"} в истории</div>
                  </div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 10, color: C.faint, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 }}>FIDE-equiv</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: C.cyan, fontFamily: "ui-monospace, monospace" }}>~{fide}</div>
                <div style={{
                  display: "inline-block",
                  marginTop: 6,
                  background: "rgba(34,211,238,0.12)",
                  border: `1px solid rgba(34,211,238,0.3)`,
                  color: C.cyan,
                  fontSize: 10,
                  padding: "2px 8px",
                  borderRadius: 99,
                  fontWeight: 700,
                  letterSpacing: 0.3,
                }}>приблизительный</div>
              </div>
            </section>

            {/* History graph */}
            <section style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: C.text, margin: "0 0 10px" }}>История · последние 30 партий</h2>
              <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 12px" }}>
                <HistoryChart history={state!.history} />
              </div>
            </section>

            {/* Weak-factor callout */}
            {weakest && (
              <section style={{
                background: "rgba(251,191,36,0.08)",
                border: `1px solid rgba(251,191,36,0.3)`,
                borderLeft: `4px solid ${C.yellow}`,
                borderRadius: 12,
                padding: "14px 18px",
                marginBottom: 20,
              }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: C.yellow, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 }}>
                  Слабая зона
                </div>
                <div style={{ fontSize: 14, color: C.text, lineHeight: 1.6 }}>
                  Твоя слабая зона: <strong style={{ color: C.yellow }}>{weakest.name}</strong> (avg {weakest.avg > 0 ? "+" : ""}{weakest.avg.toFixed(1)} / партия).
                  {" "}Тренируй <strong style={{ color: C.text }}>пазлы {weakest.code}</strong> чтобы выправить CPI.
                </div>
              </section>
            )}

            {/* Last game breakdown */}
            {lastGame && (
              <section style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: C.text, margin: "0 0 10px" }}>Последняя партия · разложение</h2>
                <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, paddingBottom: 10, borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 12, color: C.dim }}>
                      {lastGame.date?.slice(0, 16).replace("T", " ")}
                      <span style={{ marginLeft: 12, padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 800,
                        background: lastGame.breakdown?.result === "w" ? "rgba(52,211,153,0.15)" : lastGame.breakdown?.result === "l" ? "rgba(239,68,68,0.15)" : "rgba(167,139,250,0.15)",
                        color: lastGame.breakdown?.result === "w" ? C.green : lastGame.breakdown?.result === "l" ? C.red : C.purple,
                      }}>
                        {lastGame.breakdown?.result === "w" ? "WIN" : lastGame.breakdown?.result === "l" ? "LOSS" : "DRAW"}
                      </span>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 10, color: C.faint, textTransform: "uppercase" }}>ΔCPI</div>
                      <div style={{ fontSize: 20, fontWeight: 900, color: lastGame.delta > 0 ? C.green : lastGame.delta < 0 ? C.red : C.faint, fontFamily: "ui-monospace, monospace", lineHeight: 1 }}>
                        {lastGame.delta > 0 ? "+" : ""}{lastGame.delta}
                      </div>
                    </div>
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    {FACTOR_META.map((meta) => {
                      const raw = readFactor(lastGame.breakdown, meta.code);
                      const contr = contribution(meta.code, raw);
                      return (
                        <FactorBar
                          key={meta.code}
                          code={meta.code}
                          name={meta.name}
                          emoji={meta.emoji}
                          contribution={contr}
                          raw={raw}
                          signNeg={meta.sign === -1}
                        />
                      );
                    })}
                  </div>
                </div>
              </section>
            )}

            {/* Per-factor sparklines */}
            <section style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: C.text, margin: "0 0 10px" }}>Тренд по факторам · последние 10 партий</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))", gap: 10 }}>
                {FACTOR_META.map((meta) => {
                  const series = perFactorSeries[meta.code] || [];
                  const last = series[series.length - 1] ?? 0;
                  const first = series[0] ?? 0;
                  const trend = last - first;
                  const color = meta.sign === -1
                    ? (last < first ? C.green : last > first ? C.red : C.faint)
                    : (last > first ? C.green : last < first ? C.red : C.faint);
                  return (
                    <div key={meta.code} style={{
                      background: C.panel,
                      border: `1px solid ${C.border}`,
                      borderRadius: 10,
                      padding: "10px 12px",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 13 }}>{meta.emoji}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{meta.code}</span>
                          <span style={{ fontSize: 10, color: C.faint }}>{meta.name}</span>
                        </div>
                        <span style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", color, fontWeight: 700 }}>
                          {trend > 0 ? "▲" : trend < 0 ? "▼" : "·"} {Math.abs(trend).toFixed(2)}
                        </span>
                      </div>
                      <Sparkline values={series} color={color} />
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}

        {/* Footer nav */}
        <div style={{ marginTop: 24, display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13 }}>
          <Link href="/cyberchess" style={{ color: C.purple, textDecoration: "none" }}>← CyberChess</Link>
          <span style={{ color: C.faint }}>·</span>
          <Link href="/cyberchess/cpi" style={{ color: C.purple, textDecoration: "none" }}>CPI spec / формула</Link>
        </div>

        <div style={{ marginTop: 32, fontSize: 11, color: C.faint, textAlign: "center" }}>
          F4 · 2026-05-12 · data: localStorage · key: aevion_cyberchess_cpi_v1
        </div>
      </article>
    </main>
  );
}
