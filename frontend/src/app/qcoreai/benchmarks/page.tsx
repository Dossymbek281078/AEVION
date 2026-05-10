"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ProductPageShell } from "@/components/ProductPageShell";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

type ModelBenchmark = {
  provider: string;
  model: string;
  speedScore: number;
  qualityScore: number;
  costScore: number;
  contextWindow: number;
};

type BenchmarkData = {
  models: ModelBenchmark[];
  lastUpdated: string;
  note: string;
};

type SortKey = "speedScore" | "qualityScore" | "costScore" | "contextWindow";

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: "#d97706",
  openai: "#10b981",
  gemini: "#3b82f6",
  deepseek: "#8b5cf6",
  grok: "#ef4444",
};

function fmtCtx(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 8, background: "#1e293b", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${value}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.3s ease" }} />
      </div>
      <span style={{ fontSize: "0.8rem", color: "#94a3b8", width: 28, textAlign: "right" }}>{value}</span>
    </div>
  );
}

export default function BenchmarksPage() {
  const [data, setData] = useState<BenchmarkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("qualityScore");
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(apiUrl("/api/qcoreai/benchmarks"));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setData(await res.json());
      } catch (e: any) {
        setError(e?.message || "Failed to load benchmarks");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const sorted = useMemo(() => {
    if (!data) return [];
    return [...data.models].sort((a, b) => {
      const diff = a[sortKey] - b[sortKey];
      return sortAsc ? diff : -diff;
    });
  }, [data, sortKey, sortAsc]);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((v) => !v);
    else { setSortKey(key); setSortAsc(false); }
  }

  function ColHeader({ label, col, color }: { label: string; col: SortKey; color: string }) {
    const active = sortKey === col;
    return (
      <button
        onClick={() => handleSort(col)}
        style={{
          background: "none", border: "none", cursor: "pointer",
          color: active ? color : "#64748b",
          fontWeight: active ? 700 : 600,
          fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em",
          display: "flex", alignItems: "center", gap: 4, padding: 0,
        }}
      >
        {label} {active ? (sortAsc ? "↑" : "↓") : ""}
      </button>
    );
  }

  return (
    <ProductPageShell>
      <Wave1Nav />
      <div style={{ minHeight: "100vh", background: "#0a0e1a", color: "#e2e8f0", fontFamily: "Inter, system-ui, sans-serif" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1.5rem" }}>

          {/* Header */}
          <div style={{ marginBottom: "2rem" }}>
            <Link href="/qcoreai/providers" style={{ color: "#5eead4", textDecoration: "none", fontSize: "0.85rem", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 8 }}>
              ← AI Providers
            </Link>
            <h1 style={{ margin: 0, fontSize: "1.6rem", fontWeight: 700, color: "#f1f5f9" }}>
              Model Benchmarks
            </h1>
            <p style={{ margin: "0.4rem 0 0", color: "#94a3b8", fontSize: "0.88rem" }}>
              Speed, quality, and cost scores across top AI models. Click a column to sort.
            </p>
          </div>

          {/* Score legend */}
          <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem", color: "#94a3b8" }}>
              <div style={{ width: 12, height: 4, borderRadius: 2, background: "#3b82f6" }} />
              Speed
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem", color: "#94a3b8" }}>
              <div style={{ width: 12, height: 4, borderRadius: 2, background: "#8b5cf6" }} />
              Quality
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem", color: "#94a3b8" }}>
              <div style={{ width: 12, height: 4, borderRadius: 2, background: "#10b981" }} />
              Cost efficiency
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "3rem", color: "#475569" }}>Loading benchmarks...</div>
          ) : error ? (
            <div style={{ background: "#1a1f2e", border: "1px solid #ef4444", borderRadius: 8, padding: "1rem 1.25rem", color: "#fca5a5" }}>
              {error}
            </div>
          ) : !data ? null : (
            <>
              {/* Table */}
              <div style={{ background: "#0f172a", borderRadius: 12, overflow: "hidden", border: "1px solid #1e293b" }}>
                {/* Header row */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "220px 1fr 1fr 1fr 100px",
                  padding: "0.75rem 1.25rem",
                  borderBottom: "1px solid #1e293b",
                  alignItems: "center",
                  gap: "0.5rem",
                }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Model</div>
                  <ColHeader label="Speed" col="speedScore" color="#3b82f6" />
                  <ColHeader label="Quality" col="qualityScore" color="#8b5cf6" />
                  <ColHeader label="Cost" col="costScore" color="#10b981" />
                  <ColHeader label="Context" col="contextWindow" color="#f59e0b" />
                </div>
                {/* Data rows */}
                {sorted.map((m, i) => {
                  const pColor = PROVIDER_COLORS[m.provider] ?? "#94a3b8";
                  return (
                    <div
                      key={`${m.provider}/${m.model}`}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "220px 1fr 1fr 1fr 100px",
                        padding: "0.9rem 1.25rem",
                        borderBottom: i < sorted.length - 1 ? "1px solid #1a2235" : "none",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      {/* Model */}
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: pColor, flexShrink: 0 }} />
                          <span style={{ fontSize: "0.78rem", color: pColor, fontWeight: 600 }}>{m.provider}</span>
                        </div>
                        <div style={{ fontSize: "0.82rem", color: "#cbd5e1", fontFamily: "monospace" }}>{m.model}</div>
                      </div>
                      {/* Speed */}
                      <ScoreBar value={m.speedScore} color="#3b82f6" />
                      {/* Quality */}
                      <ScoreBar value={m.qualityScore} color="#8b5cf6" />
                      {/* Cost efficiency */}
                      <ScoreBar value={m.costScore} color="#10b981" />
                      {/* Context window */}
                      <div style={{ textAlign: "right" }}>
                        <span style={{
                          display: "inline-block",
                          padding: "0.15rem 0.5rem",
                          borderRadius: 4,
                          background: "#1e293b",
                          color: "#f59e0b",
                          fontSize: "0.78rem",
                          fontWeight: 600,
                          fontFamily: "monospace",
                        }}>
                          {fmtCtx(m.contextWindow)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Note */}
              {data.note && (
                <div style={{ marginTop: "1rem", color: "#475569", fontSize: "0.78rem" }}>
                  {data.note} · Last updated: {data.lastUpdated}
                </div>
              )}
            </>
          )}

          {/* Footer links */}
          <div style={{ marginTop: "2rem", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <Link href="/qcoreai/providers" style={{ color: "#5eead4", textDecoration: "none", fontSize: "0.85rem" }}>AI Providers</Link>
            <Link href="/qcoreai/analytics" style={{ color: "#5eead4", textDecoration: "none", fontSize: "0.85rem" }}>Analytics</Link>
            <Link href="/qcoreai/multi" style={{ color: "#5eead4", textDecoration: "none", fontSize: "0.85rem" }}>Multi-Agent</Link>
          </div>
        </div>
      </div>
    </ProductPageShell>
  );
}
