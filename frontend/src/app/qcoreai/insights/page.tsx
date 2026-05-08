"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProductPageShell } from "@/components/ProductPageShell";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

function bearerHeader(): HeadersInit {
  if (typeof window === "undefined") return {};
  const t = localStorage.getItem("aevion_token") || sessionStorage.getItem("aevion_token");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

type Insights = {
  topAgentCosts: Array<{ role: string; avgCostUsd: number; totalCostUsd: number; calls: number; avgDurationMs: number }>;
  strategyRatings: Array<{ strategy: string; avgRating: number; runs: number; avgCostUsd: number }>;
  avgCostByHour: Array<{ hour: number; avgCostUsd: number; runs: number }>;
};

const ROLE_COLORS: Record<string, string> = {
  analyst: "#2563eb", writer: "#059669", critic: "#d97706",
  researcher: "#7c3aed", editor: "#0891b2", summarizer: "#6366f1",
};

const STRATEGY_COLORS: Record<string, string> = {
  sequential: "#0d9488", parallel: "#4338ca", debate: "#7c3aed",
};

function Bar({ value, max, color, height = 8 }: { value: number; max: number; color: string; height?: number }) {
  return (
    <div style={{ height, borderRadius: height / 2, background: "#f1f5f9", overflow: "hidden" }}>
      <div style={{ height: "100%", borderRadius: height / 2, background: color, width: max > 0 ? `${(value / max) * 100}%` : "0%" }} />
    </div>
  );
}

export default function InsightsPage() {
  const [data, setData] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(apiUrl("/api/qcoreai/insights"), { headers: bearerHeader() })
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch((e) => setError(e?.message || "Failed"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main>
      <Wave1Nav />
      <ProductPageShell>
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", margin: 0 }}>🔍 Run Insights</h1>
            <Link href="/qcoreai/analytics" style={{ fontSize: 12, color: "#4338ca", fontWeight: 700, textDecoration: "none" }}>← Analytics</Link>
          </div>
          <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>
            Deep patterns from your runs — agent cost breakdown, strategy effectiveness, and peak usage hours.
          </p>
        </div>

        {loading && <p style={{ color: "#94a3b8" }}>Loading insights…</p>}
        {error && <p style={{ color: "#dc2626" }}>{error}</p>}

        {data && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Top agent costs */}
            {data.topAgentCosts.length > 0 && (
              <div style={{ padding: 20, borderRadius: 14, border: "1px solid rgba(15,23,42,0.1)", background: "#fff" }}>
                <h2 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 14px", color: "#0f172a" }}>💰 Agent cost breakdown</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {(() => {
                    const maxTotal = Math.max(...data.topAgentCosts.map((a) => a.totalCostUsd));
                    return data.topAgentCosts.map((agent) => (
                      <div key={agent.role}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                          <span style={{ minWidth: 80, fontWeight: 700, fontSize: 12, color: ROLE_COLORS[agent.role] || "#475569" }}>{agent.role}</span>
                          <div style={{ flex: 1 }}>
                            <Bar value={agent.totalCostUsd} max={maxTotal} color={ROLE_COLORS[agent.role] || "#475569"} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#0f172a", minWidth: 60, textAlign: "right" }}>
                            ${agent.totalCostUsd.toFixed(4)}
                          </span>
                          <span style={{ fontSize: 10, color: "#94a3b8", minWidth: 60 }}>
                            {agent.calls} calls
                          </span>
                          <span style={{ fontSize: 10, color: "#94a3b8", minWidth: 55 }}>
                            ~{agent.avgDurationMs ? (agent.avgDurationMs / 1000).toFixed(1) : "—"}s avg
                          </span>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {/* Strategy ratings */}
              {data.strategyRatings.length > 0 && (
                <div style={{ padding: 20, borderRadius: 14, border: "1px solid rgba(15,23,42,0.1)", background: "#fff" }}>
                  <h2 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 14px", color: "#0f172a" }}>⭐ Strategy effectiveness</h2>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {data.strategyRatings.map((s) => {
                      const color = STRATEGY_COLORS[s.strategy] || "#475569";
                      const ratingPct = Math.max(0, Math.min(100, (s.avgRating + 1) * 50)); // -1..1 → 0..100
                      return (
                        <div key={s.strategy}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <span style={{ fontWeight: 800, fontSize: 12, color, minWidth: 80 }}>{s.strategy}</span>
                            <span style={{ fontSize: 11, color: "#94a3b8" }}>{s.runs} runs</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#0f172a", marginLeft: "auto" }}>
                              avg ${s.avgCostUsd.toFixed(4)}
                            </span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 10, color: "#dc2626" }}>👎</span>
                            <Bar value={ratingPct} max={100} color={ratingPct > 50 ? "#10b981" : ratingPct < 50 ? "#ef4444" : "#94a3b8"} />
                            <span style={{ fontSize: 10, color: "#065f46" }}>👍</span>
                            <span style={{ fontSize: 10, color: "#475569", minWidth: 30, textAlign: "right" }}>
                              {s.avgRating > 0 ? "+" : ""}{s.avgRating.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Cost by hour */}
              {data.avgCostByHour.length > 0 && (
                <div style={{ padding: 20, borderRadius: 14, border: "1px solid rgba(15,23,42,0.1)", background: "#fff" }}>
                  <h2 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 14px", color: "#0f172a" }}>🕐 Cost by hour of day</h2>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 100 }}>
                    {Array.from({ length: 24 }, (_, h) => {
                      const entry = data.avgCostByHour.find((e) => Number(e.hour) === h);
                      const maxCost = Math.max(...data.avgCostByHour.map((e) => e.avgCostUsd));
                      const height = entry && maxCost > 0 ? Math.max(4, (entry.avgCostUsd / maxCost) * 90) : 2;
                      const isExpensive = entry && maxCost > 0 && entry.avgCostUsd >= maxCost * 0.7;
                      return (
                        <div key={h} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                          <div
                            title={entry ? `${h}:00 — avg $${entry.avgCostUsd.toFixed(5)} (${entry.runs} runs)` : `${h}:00 — no data`}
                            style={{
                              width: "100%", height,
                              borderRadius: "2px 2px 0 0",
                              background: isExpensive ? "#ef4444" : entry ? "#4338ca" : "#f1f5f9",
                              cursor: "default",
                            }}
                          />
                          {h % 6 === 0 && <span style={{ fontSize: 8, color: "#94a3b8" }}>{h}h</span>}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 10, color: "#94a3b8" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: "#4338ca" }} /> Normal
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: "#ef4444" }} /> ≥70% of peak
                    </span>
                  </div>
                </div>
              )}
            </div>

            {data.topAgentCosts.length === 0 && data.strategyRatings.length === 0 && (
              <div style={{ padding: 40, borderRadius: 14, border: "1px dashed #e2e8f0", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
                No insights yet — complete more runs and rate them with 👍/👎 to see patterns.
              </div>
            )}
          </div>
        )}
      </ProductPageShell>
    </main>
  );
}
