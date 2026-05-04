"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ProductPageShell } from "@/components/ProductPageShell";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

/* ═══════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════ */

type Analytics = {
  scope: "mine" | "anonymous";
  runs: number;
  sessions: number;
  messages: number;
  totals: { tokensIn: number; tokensOut: number; costUsd: number; durationMs: number };
  byStrategy: Array<{ strategy: string; runs: number; costUsd: number; tokens: number; avgDurationMs: number }>;
  byProvider: Array<{ provider: string; calls: number; costUsd: number; tokensIn: number; tokensOut: number }>;
  byModel: Array<{ provider: string; model: string; calls: number; costUsd: number; tokens: number }>;
  recent: Array<{ sessionId: string; runId: string; strategy: string | null; costUsd: number | null; totalDurationMs: number | null; startedAt: string; title: string }>;
};

const STRAT_COLORS: Record<string, string> = {
  sequential: "#0d9488",
  parallel: "#4338ca",
  debate: "#7c3aed",
};

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: "#d97706",
  openai: "#10a37f",
  gemini: "#4285f4",
  deepseek: "#0ea5e9",
  grok: "#ef4444",
};

const providerLabel: Record<string, string> = {
  anthropic: "Claude",
  openai: "GPT",
  gemini: "Gemini",
  deepseek: "DeepSeek",
  grok: "Grok",
};

const prettyModel = (m: string) => {
  const map: Record<string, string> = {
    "claude-sonnet-4-20250514": "Claude Sonnet 4",
    "claude-haiku-4-5-20251001": "Claude Haiku 4.5",
    "gpt-4o": "GPT-4o",
    "gpt-4o-mini": "GPT-4o Mini",
    "gpt-4-turbo": "GPT-4 Turbo",
    "gemini-2.5-flash": "Gemini 2.5 Flash",
    "gemini-2.0-flash-001": "Gemini 2.0 Flash",
    "gemini-1.5-pro": "Gemini 1.5 Pro",
    "deepseek-chat": "DeepSeek Chat",
    "deepseek-reasoner": "DeepSeek Reasoner",
    "grok-3": "Grok 3",
    "grok-3-mini": "Grok 3 Mini",
  };
  return map[m] || m;
};

function bearerHeader(): HeadersInit {
  try {
    const t = typeof window !== "undefined" ? localStorage.getItem("aevion_auth_token_v1") : null;
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch { return {}; }
}

function fmtDur(ms: number | null | undefined) {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

function fmtMoney(v: number | null | undefined, precision = 4) {
  if (v == null || !isFinite(v)) return "—";
  if (v === 0) return "$0";
  if (v < 0.0001) return "<$0.0001";
  if (v >= 100) return `$${v.toFixed(2)}`;
  return `$${v.toFixed(precision)}`;
}

function fmtNum(v: number | null | undefined) {
  if (v == null) return "—";
  return v.toLocaleString();
}

/* ═══════════════════════════════════════════════════════════════════════
   Page
   ═══════════════════════════════════════════════════════════════════════ */

type TimeseriesPoint = { date: string; runs: number; costUsd: number };
type TagCount = { tag: string; count: number };

export default function QCoreAnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [timeseries, setTimeseries] = useState<TimeseriesPoint[]>([]);
  const [topTags, setTopTags] = useState<TagCount[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setError(null);
    try {
      const [aRes, tsRes, tagRes] = await Promise.all([
        fetch(apiUrl("/api/qcoreai/analytics"), { headers: bearerHeader() }),
        fetch(apiUrl("/api/qcoreai/analytics/timeseries?days=30"), { headers: bearerHeader() }),
        fetch(apiUrl("/api/qcoreai/tags?limit=15"), { headers: bearerHeader() }),
      ]);
      const json = await aRes.json();
      if (!aRes.ok) throw new Error(json?.error || `HTTP ${aRes.status}`);
      setData(json);
      const tsJson = await tsRes.json().catch(() => ({}));
      if (Array.isArray(tsJson?.items)) setTimeseries(tsJson.items);
      const tagJson = await tagRes.json().catch(() => ({}));
      if (Array.isArray(tagJson?.items)) setTopTags(tagJson.items);
    } catch (e: any) {
      setError(e?.message || "Failed to load analytics");
    }
  };

  useEffect(() => { refresh(); }, []);

  /* Linear regression on the last min(14, n) days to project the next 7 days. */
  const forecast = useMemo(() => {
    const tail = timeseries.slice(-14);
    if (tail.length < 2) return null;
    const xs = tail.map((_, i) => i);
    const ys = tail.map((p) => p.costUsd);
    const n = xs.length;
    const sumX = xs.reduce((a, b) => a + b, 0);
    const sumY = ys.reduce((a, b) => a + b, 0);
    const sumXY = xs.reduce((acc, x, i) => acc + x * ys[i], 0);
    const sumXX = xs.reduce((acc, x) => acc + x * x, 0);
    const denom = n * sumXX - sumX * sumX;
    if (denom === 0) return null;
    const slope = (n * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / n;
    const next7Total = Array.from({ length: 7 }, (_, k) =>
      Math.max(0, intercept + slope * (n + k))
    ).reduce((a, b) => a + b, 0);
    const monthlyRunRate = next7Total > 0 ? next7Total * (30 / 7) : 0;
    return { slope, intercept, next7Total, monthlyRunRate };
  }, [timeseries]);

  const maxStrategyRuns = useMemo(() => {
    if (!data) return 1;
    return Math.max(1, ...data.byStrategy.map((s) => s.runs));
  }, [data]);

  const maxProviderCalls = useMemo(() => {
    if (!data) return 1;
    return Math.max(1, ...data.byProvider.map((s) => s.calls));
  }, [data]);

  return (
    <main>
      <ProductPageShell maxWidth={1100}>
        <Wave1Nav />

        {/* Hero */}
        <div
          style={{
            borderRadius: 20, overflow: "hidden", marginBottom: 16,
            background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #3730a3 100%)",
            color: "#fff", padding: "28px 28px 22px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 48, height: 48, borderRadius: 14,
                background: "linear-gradient(135deg, #f59e0b, #ef4444)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 900, fontSize: 14,
              }}
            >
              📊
            </div>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0, letterSpacing: "-0.02em" }}>
                QCoreAI · Analytics
              </h1>
              <p style={{ margin: "4px 0 0", fontSize: 13, opacity: 0.78 }}>
                Runs, cost, tokens and strategy mix — {data?.scope === "mine" ? "your sessions" : "anonymous sessions"}.
              </p>
            </div>
            <Link
              href="/qcoreai/multi"
              style={{
                padding: "8px 14px", borderRadius: 10,
                background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.2)",
                color: "#fff", fontSize: 12, fontWeight: 700, textDecoration: "none",
              }}
            >
              ← Back to multi-agent
            </Link>
            <a
              href={apiUrl("/api/qcoreai/analytics/export?days=30")}
              download="qcoreai-analytics-30d.csv"
              style={{
                padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                border: "1px solid rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.15)",
                color: "#fff", textDecoration: "none",
              }}
            >
              ↓ Export CSV
            </a>
          </div>
        </div>

        {error && (
          <div
            style={{
              color: "#b91c1c", background: "rgba(239,68,68,0.06)",
              border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: 10, padding: "8px 12px", fontSize: 12, marginBottom: 12,
            }}
          >
            {error}
          </div>
        )}

        {!data ? (
          <div style={{ textAlign: "center", padding: 40, color: "#64748b" }}>Loading…</div>
        ) : data.runs === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "#64748b", background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>No runs yet.</div>
            Head to <Link href="/qcoreai/multi" style={{ color: "#0e7490", fontWeight: 700 }}>multi-agent</Link> and start a pipeline — analytics will show up here.
          </div>
        ) : (
          <>
            {/* Top tiles */}
            <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 18 }}>
              <Tile label="Runs" value={fmtNum(data.runs)} accent="#0d9488" />
              <Tile label="Sessions" value={fmtNum(data.sessions)} accent="#4338ca" />
              <Tile label="Messages" value={fmtNum(data.messages)} accent="#0ea5e9" />
              <Tile label="Tokens" value={fmtNum(data.totals.tokensIn + data.totals.tokensOut)} accent="#f59e0b" sub={`${fmtNum(data.totals.tokensIn)} in · ${fmtNum(data.totals.tokensOut)} out`} />
              <Tile label="Cost" value={fmtMoney(data.totals.costUsd)} accent="#7c3aed" />
              <Tile label="Compute time" value={fmtDur(data.totals.durationMs)} accent="#ef4444" />
            </section>

            {/* Cost over time + 7-day forecast */}
            {timeseries.length > 0 && (
              <Section title="Cost over time">
                <CostTimeseriesChart points={timeseries} forecast={forecast} />
                {forecast && (
                  <div style={{ marginTop: 8, fontSize: 12, color: "#475569" }}>
                    Linear projection on last {Math.min(14, timeseries.length)} days:{" "}
                    <strong style={{ color: "#0f172a" }}>{fmtMoney(forecast.next7Total, 4)}</strong> next 7d ·{" "}
                    <strong style={{ color: "#0f172a" }}>{fmtMoney(forecast.monthlyRunRate, 2)}</strong> per month at this rate
                    {forecast.slope > 0 && <span style={{ marginLeft: 8, color: "#dc2626" }}>↑ trending up</span>}
                    {forecast.slope < 0 && <span style={{ marginLeft: 8, color: "#16a34a" }}>↓ trending down</span>}
                  </div>
                )}
              </Section>
            )}

            {/* Top tags chart */}
            {topTags.length > 0 && (
              <Section title="Top tags">
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {topTags.map((t) => {
                    const max = Math.max(1, ...topTags.map((x) => x.count));
                    const pct = (t.count / max) * 100;
                    return (
                      <div key={t.tag} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div
                          style={{
                            width: 140,
                            fontSize: 12,
                            fontWeight: 700,
                            color: "#0f766e",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={t.tag}
                        >
                          {t.tag}
                        </div>
                        <div style={{ flex: 1, height: 14, background: "rgba(13,148,136,0.08)", borderRadius: 999, overflow: "hidden" }}>
                          <div
                            style={{
                              width: `${pct}%`,
                              height: "100%",
                              background: "linear-gradient(90deg, #0d9488, #0f766e)",
                              borderRadius: 999,
                            }}
                          />
                        </div>
                        <div style={{ width: 40, textAlign: "right", fontSize: 12, color: "#0f172a", fontWeight: 700 }}>
                          {t.count}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Section>
            )}

            {/* Strategy breakdown */}
            <Section title="By strategy">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                {data.byStrategy.map((s) => (
                  <div
                    key={s.strategy}
                    style={{
                      padding: 14, borderRadius: 12,
                      background: "#fff",
                      border: `1px solid ${(STRAT_COLORS[s.strategy] || "#64748b")}33`,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <span
                        style={{
                          padding: "2px 8px", borderRadius: 999,
                          background: `${STRAT_COLORS[s.strategy] || "#64748b"}1f`,
                          color: STRAT_COLORS[s.strategy] || "#334155",
                          fontSize: 11, fontWeight: 800, textTransform: "capitalize",
                          border: `1px solid ${STRAT_COLORS[s.strategy] || "#94a3b8"}55`,
                        }}
                      >
                        {s.strategy}
                      </span>
                      <span style={{ marginLeft: "auto", fontWeight: 900, fontSize: 18, color: "#0f172a" }}>{s.runs}</span>
                    </div>
                    <Bar value={s.runs} max={maxStrategyRuns} color={STRAT_COLORS[s.strategy] || "#64748b"} />
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 8, display: "flex", justifyContent: "space-between" }}>
                      <span>{fmtMoney(s.costUsd)}</span>
                      <span>{fmtNum(s.tokens)} tok</span>
                      <span>~{fmtDur(s.avgDurationMs)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            {/* Provider breakdown */}
            <Section title="By provider">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {data.byProvider.map((p) => {
                  const color = PROVIDER_COLORS[p.provider] || "#64748b";
                  return (
                    <div key={p.provider} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 100, fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                        {providerLabel[p.provider] || p.provider}
                      </div>
                      <div style={{ flex: 1 }}>
                        <Bar value={p.calls} max={maxProviderCalls} color={color} />
                      </div>
                      <div style={{ width: 60, textAlign: "right", fontSize: 12, color: "#334155" }}>{p.calls}</div>
                      <div style={{ width: 90, textAlign: "right", fontSize: 12, color: "#64748b" }}>{fmtNum(p.tokensIn + p.tokensOut)}</div>
                      <div style={{ width: 84, textAlign: "right", fontSize: 12, color: "#0f172a", fontWeight: 700 }}>{fmtMoney(p.costUsd)}</div>
                    </div>
                  );
                })}
              </div>
            </Section>

            {/* Model breakdown table */}
            <Section title="Top models">
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, background: "#fff", borderRadius: 10, overflow: "hidden" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                      <th style={thStyle}>Model</th>
                      <th style={thStyle}>Provider</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Calls</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Tokens</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byModel.map((m, i) => (
                      <tr key={`${m.provider}-${m.model}`} style={{ background: i % 2 ? "#fafbfc" : "#fff" }}>
                        <td style={{ ...tdStyle, fontWeight: 700, color: "#0f172a" }}>{prettyModel(m.model)}</td>
                        <td style={tdStyle}>{providerLabel[m.provider] || m.provider}</td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>{fmtNum(m.calls)}</td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>{fmtNum(m.tokens)}</td>
                        <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700 }}>{fmtMoney(m.costUsd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            {/* Recent runs */}
            <Section title="Recent runs">
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {data.recent.map((r) => (
                  <Link
                    key={r.runId}
                    href={`/qcoreai/multi`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "90px 1fr 110px 90px 90px",
                      gap: 10, alignItems: "center",
                      padding: "8px 12px", borderRadius: 10,
                      background: "#fff", border: "1px solid #e2e8f0",
                      textDecoration: "none", color: "#0f172a",
                      fontSize: 12,
                    }}
                  >
                    <span
                      style={{
                        padding: "2px 8px", borderRadius: 999,
                        background: `${STRAT_COLORS[r.strategy || "sequential"] || "#64748b"}1f`,
                        color: STRAT_COLORS[r.strategy || "sequential"] || "#334155",
                        fontWeight: 800, fontSize: 10, textAlign: "center",
                        border: `1px solid ${STRAT_COLORS[r.strategy || "sequential"] || "#94a3b8"}55`,
                        textTransform: "capitalize",
                      }}
                    >
                      {r.strategy || "sequential"}
                    </span>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }}>{r.title}</span>
                    <span style={{ color: "#64748b" }}>{new Date(r.startedAt).toLocaleString()}</span>
                    <span style={{ textAlign: "right", color: "#64748b" }}>{fmtDur(r.totalDurationMs)}</span>
                    <span style={{ textAlign: "right", fontWeight: 700 }}>{fmtMoney(r.costUsd)}</span>
                  </Link>
                ))}
              </div>
            </Section>
          </>
        )}
      </ProductPageShell>
    </main>
  );
}

const thStyle: React.CSSProperties = {
  padding: "8px 12px",
  fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em",
  color: "#475569", fontWeight: 800,
  borderBottom: "1px solid #e2e8f0",
};

const tdStyle: React.CSSProperties = {
  padding: "8px 12px",
  color: "#334155",
  borderBottom: "1px solid #f1f5f9",
};

/* ═══════════════════════════════════════════════════════════════════════
   Tiles
   ═══════════════════════════════════════════════════════════════════════ */

function Tile({ label, value, accent, sub }: { label: string; value: string; accent: string; sub?: string }) {
  return (
    <div
      style={{
        padding: 14, borderRadius: 12,
        background: "#fff", border: `1px solid ${accent}33`,
        boxShadow: `0 1px 4px ${accent}0f`,
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 800, color: accent, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", marginTop: 4, letterSpacing: "-0.02em" }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
        {title}
      </div>
      {children}
    </section>
  );
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 2;
  return (
    <div style={{ height: 10, background: "#f1f5f9", borderRadius: 999, overflow: "hidden" }}>
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          background: `linear-gradient(90deg, ${color}, ${color}cc)`,
          borderRadius: 999,
          transition: "width 0.3s",
        }}
      />
    </div>
  );
}

function CostTimeseriesChart({
  points,
  forecast,
}: {
  points: TimeseriesPoint[];
  forecast: { slope: number; intercept: number; next7Total: number; monthlyRunRate: number } | null;
}) {
  const W = 700;
  const H = 180;
  const PAD_L = 36;
  const PAD_R = 8;
  const PAD_T = 8;
  const PAD_B = 28;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const projected = forecast
    ? Array.from({ length: 7 }, (_, k) => Math.max(0, forecast.intercept + forecast.slope * (points.length + k)))
    : [];
  const allCosts = [...points.map((p) => p.costUsd), ...projected];
  const maxCost = Math.max(0.0001, ...allCosts);
  const total = points.length + projected.length;

  const xFor = (i: number) => PAD_L + (total <= 1 ? 0 : (i / (total - 1)) * innerW);
  const yFor = (cost: number) => PAD_T + innerH - (cost / maxCost) * innerH;

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(p.costUsd)}`).join(" ");
  const projPath = projected.length > 0
    ? `M ${xFor(points.length - 1)} ${yFor(points[points.length - 1].costUsd)}` +
      projected.map((c, k) => ` L ${xFor(points.length + k)} ${yFor(c)}`).join("")
    : "";

  // Y-axis ticks (3 levels)
  const yTicks = [0, maxCost / 2, maxCost];

  return (
    <div style={{ overflowX: "auto" }}>
      <svg width={W} height={H} role="img" aria-label="Cost over time" style={{ background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", display: "block", minWidth: W }}>
        {/* Grid */}
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={PAD_L} x2={W - PAD_R} y1={yFor(v)} y2={yFor(v)} stroke="#f1f5f9" strokeWidth={1} />
            <text x={PAD_L - 4} y={yFor(v) + 3} fontSize={9} fill="#94a3b8" textAnchor="end">
              ${v.toFixed(v < 0.01 ? 4 : 2)}
            </text>
          </g>
        ))}
        {/* Forecast region */}
        {projected.length > 0 && (
          <rect
            x={xFor(points.length - 1)}
            y={PAD_T}
            width={W - PAD_R - xFor(points.length - 1)}
            height={innerH}
            fill="rgba(124,58,237,0.04)"
          />
        )}
        {/* Cost line */}
        <path d={linePath} fill="none" stroke="#0d9488" strokeWidth={2} />
        {/* Forecast line (dashed) */}
        {projPath && (
          <path d={projPath} fill="none" stroke="#7c3aed" strokeWidth={2} strokeDasharray="4 4" />
        )}
        {/* Points */}
        {points.map((p, i) => (
          <circle key={i} cx={xFor(i)} cy={yFor(p.costUsd)} r={2.5} fill="#0d9488">
            <title>{`${p.date}: ${p.runs} runs · $${p.costUsd.toFixed(4)}`}</title>
          </circle>
        ))}
        {/* X-axis labels (first, mid, last + forecast end) */}
        {points.length > 0 && (
          <>
            <text x={xFor(0)} y={H - 10} fontSize={9} fill="#64748b" textAnchor="start">
              {points[0].date.slice(5)}
            </text>
            {points.length > 2 && (
              <text x={xFor(Math.floor((points.length - 1) / 2))} y={H - 10} fontSize={9} fill="#64748b" textAnchor="middle">
                {points[Math.floor((points.length - 1) / 2)].date.slice(5)}
              </text>
            )}
            <text x={xFor(points.length - 1)} y={H - 10} fontSize={9} fill="#64748b" textAnchor="middle">
              {points[points.length - 1].date.slice(5)}
            </text>
            {projected.length > 0 && (
              <text x={xFor(total - 1)} y={H - 10} fontSize={9} fill="#7c3aed" textAnchor="end" fontWeight={700}>
                +7d
              </text>
            )}
          </>
        )}
        {/* Legend */}
        <g transform={`translate(${PAD_L}, ${PAD_T + 4})`}>
          <line x1={0} x2={14} y1={0} y2={0} stroke="#0d9488" strokeWidth={2} />
          <text x={18} y={3} fontSize={10} fill="#475569">Actual</text>
          {projPath && (
            <>
              <line x1={62} x2={76} y1={0} y2={0} stroke="#7c3aed" strokeWidth={2} strokeDasharray="3 3" />
              <text x={80} y={3} fontSize={10} fill="#475569">Forecast</text>
            </>
          )}
        </g>
      </svg>
    </div>
  );
}
