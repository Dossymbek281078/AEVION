"use client";

import { useEffect, useState } from "react";

type StatEntry = {
  strategy: string;
  provider: string;
  latency_ms: number;
  tokens_estimate: number;
  created_at: string;
};

type StatsResponse = {
  source: string;
  total: number;
  byStrategy: { strategy: string; cnt: number }[];
  avgLatencyMs: number;
  topProviders: { provider: string; cnt: number }[];
  recent: StatEntry[];
};

const STRATEGY_COLORS: Record<string, string> = {
  auto: "#00ff88",
  speed: "#00ccff",
  quality: "#cc88ff",
  cost: "#ffcc00",
};

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: "#ff8800",
  openai: "#74aa9c",
  gemini: "#4285f4",
  deepseek: "#ff4466",
  grok: "#ffffff",
};

function ProviderBar({ provider, cnt, max }: { provider: string; cnt: number; max: number }) {
  const pct = max > 0 ? Math.round((cnt / max) * 100) : 0;
  const color = PROVIDER_COLORS[provider] ?? "#00ff88";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "#88aa88", fontFamily: "monospace", fontSize: 11 }}>{provider}</span>
        <span style={{ color, fontFamily: "monospace", fontSize: 11, fontWeight: 700 }}>{cnt}</span>
      </div>
      <div style={{ height: 3, background: "#0a120a", borderRadius: 2 }}>
        <div style={{ height: 3, width: `${pct}%`, background: color, borderRadius: 2, boxShadow: `0 0 6px ${color}66`, transition: "width 0.5s" }} />
      </div>
    </div>
  );
}

export default function RequestCard({ refreshTick }: { refreshTick?: number }) {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api-backend/api/qfusionai/stats")
      .then((r) => r.json())
      .then((d) => setStats(d as StatsResponse))
      .catch(() => void 0)
      .finally(() => setLoading(false));
  }, [refreshTick]);

  const maxProviderCnt = stats?.topProviders[0]?.cnt ?? 1;

  return (
    <div style={{
      background: "#030a03",
      border: "1px solid #1a2a1a",
      borderRadius: 12,
      padding: 18,
      display: "flex",
      flexDirection: "column",
      gap: 16,
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "#00ff88", fontFamily: "monospace", fontSize: 13, fontWeight: 700, letterSpacing: 1 }}>
          STATS
        </span>
        {stats && (
          <span style={{ color: "#334433", fontFamily: "monospace", fontSize: 10 }}>
            src: {stats.source}
          </span>
        )}
      </div>

      {loading && (
        <div style={{ color: "#334433", fontFamily: "monospace", fontSize: 12 }}>Loading stats...</div>
      )}

      {stats && (
        <>
          {/* Summary row */}
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1, background: "#050f05", border: "1px solid #1a3a1a", borderRadius: 8, padding: "10px 14px", textAlign: "center" }}>
              <div style={{ color: "#00ff88", fontFamily: "monospace", fontSize: 22, fontWeight: 700 }}>{stats.total}</div>
              <div style={{ color: "#334433", fontFamily: "monospace", fontSize: 10, marginTop: 2 }}>TOTAL</div>
            </div>
            <div style={{ flex: 1, background: "#050f05", border: "1px solid #1a3a1a", borderRadius: 8, padding: "10px 14px", textAlign: "center" }}>
              <div style={{ color: "#00ccff", fontFamily: "monospace", fontSize: 22, fontWeight: 700 }}>{stats.avgLatencyMs}</div>
              <div style={{ color: "#334433", fontFamily: "monospace", fontSize: 10, marginTop: 2 }}>AVG ms</div>
            </div>
          </div>

          {/* Top providers chart */}
          {stats.topProviders.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ color: "#446644", fontFamily: "monospace", fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>
                Top Providers
              </span>
              {stats.topProviders.map((p) => (
                <ProviderBar key={p.provider} provider={p.provider} cnt={p.cnt} max={maxProviderCnt} />
              ))}
            </div>
          )}

          {/* Strategy distribution */}
          {stats.byStrategy.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {stats.byStrategy.map((s) => (
                <span
                  key={s.strategy}
                  style={{
                    background: `${STRATEGY_COLORS[s.strategy] ?? "#00ff88"}11`,
                    border: `1px solid ${STRATEGY_COLORS[s.strategy] ?? "#00ff88"}44`,
                    color: STRATEGY_COLORS[s.strategy] ?? "#00ff88",
                    padding: "3px 10px",
                    borderRadius: 5,
                    fontSize: 11,
                    fontFamily: "monospace",
                  }}
                >
                  {s.strategy}: {s.cnt}
                </span>
              ))}
            </div>
          )}

          {/* Recent requests */}
          {stats.recent.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <span style={{ color: "#446644", fontFamily: "monospace", fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>
                Recent
              </span>
              {stats.recent.map((r, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 8,
                    padding: "6px 10px",
                    background: "#020802",
                    border: "1px solid #111a11",
                    borderRadius: 6,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{
                    color: STRATEGY_COLORS[r.strategy] ?? "#00ff88",
                    fontFamily: "monospace",
                    fontSize: 10,
                    fontWeight: 700,
                    minWidth: 44,
                  }}>
                    {r.strategy}
                  </span>
                  <span style={{ color: "#557755", fontFamily: "monospace", fontSize: 10, flex: 1 }}>
                    {r.provider}
                  </span>
                  <span style={{ color: "#334433", fontFamily: "monospace", fontSize: 10 }}>
                    {r.latency_ms}ms
                  </span>
                </div>
              ))}
            </div>
          )}

          {stats.total === 0 && (
            <div style={{ color: "#334433", fontFamily: "monospace", fontSize: 12, textAlign: "center", padding: "10px 0" }}>
              No requests yet. Run a query above!
            </div>
          )}
        </>
      )}
    </div>
  );
}
