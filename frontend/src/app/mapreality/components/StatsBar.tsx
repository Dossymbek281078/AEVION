"use client";

import { useEffect, useState } from "react";

export type StatsData = {
  total: number;
  byCategory: { need: number; event: number; request: number };
  byCountry: Array<{ country: string; count: number }>;
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  need: { bg: "#bae6fd", text: "#075985", label: "Needs" },
  event: { bg: "#fef08a", text: "#854d0e", label: "Events" },
  request: { bg: "#bbf7d0", text: "#166534", label: "Requests" },
};

export function StatsBar({ refreshKey }: { refreshKey: number }) {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const r = await fetch("/api/mapreality/stats", { cache: "no-store" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = (await r.json()) as StatsData;
        if (!cancelled) setStats(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "load failed");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (error) {
    return (
      <div style={{ padding: "12px 16px", background: "#fee2e2", color: "#991b1b", borderRadius: 12, fontSize: 13 }}>
        Stats unavailable: {error}
      </div>
    );
  }

  if (!stats) {
    return (
      <div style={{ padding: "12px 16px", background: "rgba(255,255,255,0.05)", color: "#94a3b8", borderRadius: 12, fontSize: 13 }}>
        Loading stats…
      </div>
    );
  }

  const cats = (Object.keys(stats.byCategory) as Array<keyof StatsData["byCategory"]>);
  const max = Math.max(1, ...cats.map((c) => stats.byCategory[c]));

  return (
    <div
      style={{
        padding: 16,
        background: "linear-gradient(135deg, rgba(186,230,253,0.08), rgba(187,247,208,0.08))",
        border: "1px solid rgba(148, 163, 184, 0.2)",
        borderRadius: 16,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1, color: "#94a3b8" }}>Active signals</div>
          <div style={{ fontSize: 36, fontWeight: 700, color: "#e2e8f0", lineHeight: 1 }}>{stats.total}</div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {stats.byCountry.slice(0, 5).map((c) => (
            <span
              key={c.country}
              style={{
                background: "rgba(148, 163, 184, 0.15)",
                color: "#cbd5e1",
                padding: "3px 9px",
                borderRadius: 999,
                fontSize: 12,
              }}
            >
              {c.country} · {c.count}
            </span>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {cats.map((c) => {
          const color = CATEGORY_COLORS[c];
          const n = stats.byCategory[c];
          const pct = (n / max) * 100;
          return (
            <div key={c} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 80, fontSize: 12, color: "#cbd5e1" }}>{color.label}</div>
              <div style={{ flex: 1, height: 10, background: "rgba(148,163,184,0.12)", borderRadius: 999, overflow: "hidden" }}>
                <div
                  style={{
                    width: `${pct}%`,
                    height: "100%",
                    background: color.bg,
                    transition: "width 250ms ease",
                  }}
                />
              </div>
              <div style={{ width: 40, fontSize: 12, color: "#e2e8f0", fontWeight: 600, textAlign: "right" }}>{n}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
