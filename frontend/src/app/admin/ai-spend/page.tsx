"use client";

// Admin dashboard: cross-module AI spend + savings from the smartComplete
// platform layer. Reads GET /api/qcoreai/smart/savings, which returns the
// durable all-time aggregate (per module) from the smart_run_log when a
// database is reachable, else this process's in-memory session tally.
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiBase";

type ModuleAgg = {
  module: string;
  runs: number;
  facts: number;
  light: number;
  deep: number;
  totalCostUsd: number;
  savedUsd: number;
  savedPct?: number;
};

type Savings = {
  scope: "all-time" | "session";
  runs: number;
  facts: number;
  light: number;
  deep: number;
  totalCostUsd: number;
  estAlwaysCouncilUsd: number;
  savedUsd: number;
  savedPct: number;
  perModule: ModuleAgg[];
};

const usd = (n: number) => (n >= 0.005 ? `$${n.toFixed(2)}` : n > 0 ? "<$0.01" : "$0.00");
const usd4 = (n: number) => `$${n.toFixed(4)}`;

export default function AiSpendPage() {
  const [data, setData] = useState<Savings | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await fetch(apiUrl("/api/qcoreai/smart/savings"), { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = (await r.json()) as Savings;
      setData(j);
      setErr(null);
    } catch (e: any) {
      setErr(e?.message || "failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  const card: React.CSSProperties = {
    background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16,
  };
  const th: React.CSSProperties = { textAlign: "left", padding: "8px 10px", fontSize: 12, color: "#64748b", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" };
  const td: React.CSSProperties = { padding: "8px 10px", fontSize: 13, borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" };

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "24px 20px", fontFamily: "system-ui, sans-serif", color: "#0f172a" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>AI spend by module</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Link href="/admin" style={{ fontSize: 13, color: "#0d9488", textDecoration: "none" }}>← Admin</Link>
          <button onClick={load} style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Refresh</button>
        </div>
      </div>
      <p style={{ color: "#64748b", fontSize: 13, margin: "4px 0 18px" }}>
        Every module that routes an LLM call through the platform <code>smartComplete</code> layer is counted here — factual
        lookups go to a single flagship, open questions get the weight-graded Council. This is what the router saved vs always
        running the full Council.
      </p>

      {loading && <p style={{ color: "#64748b" }}>Loading…</p>}
      {err && <p style={{ color: "#b91c1c" }}>Could not load: {err}</p>}

      {data && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 18 }}>
            <div style={card}>
              <div style={{ fontSize: 12, color: "#64748b" }}>Saved</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: "#059669" }}>{usd(data.savedUsd)}</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>{Math.round(data.savedPct)}% vs always-Council</div>
            </div>
            <div style={card}>
              <div style={{ fontSize: 12, color: "#64748b" }}>Smart calls</div>
              <div style={{ fontSize: 24, fontWeight: 900 }}>{data.runs}</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>{data.facts} fact · {data.light} light · {data.deep} deep</div>
            </div>
            <div style={card}>
              <div style={{ fontSize: 12, color: "#64748b" }}>Actual spend</div>
              <div style={{ fontSize: 24, fontWeight: 900 }}>{usd(data.totalCostUsd)}</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>vs {usd(data.estAlwaysCouncilUsd)} always-Council</div>
            </div>
            <div style={card}>
              <div style={{ fontSize: 12, color: "#64748b" }}>Scope</div>
              <div style={{ fontSize: 16, fontWeight: 800, marginTop: 6 }}>{data.scope === "all-time" ? "All-time (DB)" : "Session (in-memory)"}</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>{data.scope === "all-time" ? "persisted" : "resets on restart"}</div>
            </div>
          </div>

          <div style={{ ...card, padding: 0, overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 620 }}>
              <thead>
                <tr>
                  <th style={th}>Module</th>
                  <th style={th}>Calls</th>
                  <th style={th}>Fact→single</th>
                  <th style={th}>Focused→light</th>
                  <th style={th}>Heavy→deep</th>
                  <th style={th}>Spend</th>
                  <th style={th}>Saved</th>
                </tr>
              </thead>
              <tbody>
                {data.perModule.length === 0 && (
                  <tr><td style={td} colSpan={7}>No smart calls yet.</td></tr>
                )}
                {data.perModule.map((m) => (
                  <tr key={m.module}>
                    <td style={{ ...td, fontWeight: 800 }}>{m.module}</td>
                    <td style={td}>{m.runs}</td>
                    <td style={td}>{m.facts}</td>
                    <td style={td}>{m.light}</td>
                    <td style={td}>{m.deep}</td>
                    <td style={td}>{usd4(m.totalCostUsd)}</td>
                    <td style={{ ...td, color: "#059669", fontWeight: 700 }}>{usd(m.savedUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
