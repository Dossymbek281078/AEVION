"use client";

import { spendCompleteness } from "@/lib/spendCompleteness";

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
  /** Записей расхода потеряно. Необязательное: старый бэкенд поля не шлёт,
   *  и «нет поля» — это не ноль, а «не знаю». */
  droppedRuns?: number;
};

const usd = (n: number) => (n >= 0.005 ? `$${n.toFixed(2)}` : n > 0 ? "<$0.01" : "$0.00");
const usd4 = (n: number) => `$${n.toFixed(4)}`;

type Day = { date: string; runs: number; savedUsd: number; costUsd: number };

export default function AiSpendPage() {
  const [data, setData] = useState<Savings | null>(null);
  const [daily, setDaily] = useState<Day[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [sR, dR] = await Promise.all([
        fetch(apiUrl("/api/qcoreai/smart/savings"), { cache: "no-store" }),
        fetch(apiUrl("/api/qcoreai/smart/savings/daily?days=7"), { cache: "no-store" }),
      ]);
      if (!sR.ok) throw new Error(`HTTP ${sR.status}`);
      const j = (await sR.json()) as Savings;
      setData(j);
      if (dR.ok) {
        const dj = (await dR.json()) as { series?: Day[] };
        setDaily(Array.isArray(dj.series) ? dj.series : []);
      }
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
          <a href={apiUrl("/api/qcoreai/smart/savings.csv")} style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", fontSize: 13, fontWeight: 700, color: "#334155", textDecoration: "none" }}>Export CSV</a>
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
              {/* Полнота числа выше. Учёт расхода — «по возможности»: он не роняет
                  операцию, ради которой его зовут, и потому может тихо не записать.
                  Раньше об этом знал только журнал сервера, куда никто не смотрит,
                  а сводка при сломанной записи выглядела как при исправной.
                  Три исхода различаются намеренно: поля НЕТ (старый бэкенд, ответа
                  нет вовсе) — это не то же самое, что ноль. */}
              {(() => {
                const c = spendCompleteness(data.droppedRuns);
                if (c.kind === "unknown")
                  return <div style={{ fontSize: 12, color: "#94a3b8" }}>полнота не сообщается</div>;
                if (c.kind === "incomplete")
                  return (
                    <div style={{ fontSize: 12, color: "#b91c1c", fontWeight: 700 }}>
                      неполно: {c.lost} записей потеряно
                    </div>
                  );
                return null;
              })()}
            </div>
            <div style={card}>
              <div style={{ fontSize: 12, color: "#64748b" }}>Scope</div>
              <div style={{ fontSize: 16, fontWeight: 800, marginTop: 6 }}>{data.scope === "all-time" ? "All-time (DB)" : "Session (in-memory)"}</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>{data.scope === "all-time" ? "persisted" : "resets on restart"}</div>
            </div>
          </div>

          {daily.length > 0 && (
            <div style={{ ...card, marginBottom: 18 }}>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>
                Saved per day · last {daily.length} days · total {usd(daily.reduce((s, d) => s + d.savedUsd, 0))}
              </div>
              <Sparkline days={daily} />
            </div>
          )}

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

// Minimal dependency-free SVG bar sparkline of daily savings.
function Sparkline({ days }: { days: Day[] }) {
  const W = 560, H = 64, pad = 4;
  const max = Math.max(...days.map((d) => d.savedUsd), 0.0001);
  const n = days.length;
  const bw = (W - pad * 2) / n;
  return (
    <div style={{ overflowX: "auto" }}>
      <svg viewBox={`0 0 ${W} ${H + 16}`} width="100%" style={{ maxWidth: W, display: "block" }} role="img" aria-label="Saved per day">
        {days.map((d, i) => {
          const h = Math.max(1, (d.savedUsd / max) * H);
          const x = pad + i * bw;
          return (
            <g key={d.date}>
              <rect x={x + 1} y={H - h} width={Math.max(1, bw - 2)} height={h} rx={2} fill="#10b981">
                <title>{`${d.date}: $${d.savedUsd.toFixed(3)} saved · ${d.runs} calls`}</title>
              </rect>
              <text x={x + bw / 2} y={H + 12} textAnchor="middle" fontSize="8" fill="#94a3b8">{d.date.slice(5)}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
