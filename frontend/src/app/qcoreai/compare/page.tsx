"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ProductPageShell } from "@/components/ProductPageShell";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

function bearerHeader(): HeadersInit {
  if (typeof window === "undefined") return {};
  const t = localStorage.getItem("aevion_token") || sessionStorage.getItem("aevion_token");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

type RunDetail = {
  id: string;
  userInput: string;
  strategy: string | null;
  status: string;
  totalCostUsd: number | null;
  totalDurationMs: number | null;
  finalContent: string | null;
  startedAt: string;
};

type CostBreakdown = {
  role: string;
  provider: string | null;
  model: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
  costUsd: number | null;
};

type RunData = { run: RunDetail; breakdown: CostBreakdown[]; totalCostUsd: number };

function fmt$(n: number | null | undefined) {
  if (!n) return "—";
  return `$${n.toFixed(5)}`;
}
function fmtMs(ms: number | null | undefined) {
  if (!ms) return "—";
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}
function fmtTok(n: number | null | undefined) {
  if (!n) return "—";
  return n.toLocaleString();
}

const ROLE_COLORS: Record<string, string> = {
  analyst: "#2563eb", writer: "#059669", critic: "#d97706",
  pro: "#16a34a", con: "#dc2626", moderator: "#7c3aed", judge: "#d97706",
};

function CompareCol({ label, data, loading }: { label: string; data: RunData | null; loading: boolean }) {
  const [showFull, setShowFull] = useState(false);
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontWeight: 800, fontSize: 13, color: "#0f172a", marginBottom: 8, padding: "6px 10px", borderRadius: 8, background: "#f8fafc", border: "1px solid rgba(15,23,42,0.1)" }}>
        {label}
        {data && <span style={{ fontWeight: 400, fontSize: 11, color: "#64748b", marginLeft: 8 }}>{data.run.id.slice(0, 8)}…</span>}
      </div>
      {loading && <p style={{ color: "#94a3b8", fontSize: 12 }}>Loading…</p>}
      {!loading && !data && <p style={{ color: "#94a3b8", fontSize: 12 }}>No run selected.</p>}
      {data && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Prompt */}
          <div style={{ padding: "10px 12px", borderRadius: 10, background: "#0f172a", color: "#fff", fontSize: 12 }}>
            {data.run.userInput.length > 200 ? data.run.userInput.slice(0, 200) + "…" : data.run.userInput}
          </div>

          {/* Stats */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              { label: "Strategy", value: data.run.strategy || "—" },
              { label: "Cost", value: fmt$(data.totalCostUsd) },
              { label: "Duration", value: fmtMs(data.run.totalDurationMs) },
              { label: "Status", value: data.run.status },
            ].map(({ label: l, value }) => (
              <div key={l} style={{ padding: "4px 10px", borderRadius: 7, background: "#f1f5f9", fontSize: 11 }}>
                <span style={{ color: "#94a3b8" }}>{l}: </span>
                <span style={{ fontWeight: 700, color: "#0f172a" }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Per-agent cost */}
          {data.breakdown.length > 0 && (
            <div style={{ padding: "8px 12px", borderRadius: 8, background: "#f8fafc", border: "1px solid rgba(15,23,42,0.08)" }}>
              <div style={{ fontWeight: 700, fontSize: 11, color: "#64748b", marginBottom: 6 }}>Per-agent</div>
              {data.breakdown.map((b, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 3, fontSize: 11 }}>
                  <span style={{ fontWeight: 700, color: ROLE_COLORS[b.role] || "#475569", minWidth: 52 }}>{b.role}</span>
                  <span style={{ color: "#94a3b8", flex: 1 }}>{b.model?.split("-").slice(0, 2).join("-") || "—"}</span>
                  <span style={{ fontWeight: 700 }}>{fmt$(b.costUsd)}</span>
                  <span style={{ color: "#94a3b8" }}>{fmtTok((b.tokensIn ?? 0) + (b.tokensOut ?? 0))} tok</span>
                </div>
              ))}
            </div>
          )}

          {/* Final answer */}
          {data.run.finalContent && (
            <div style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(124,58,237,0.04)", border: "1px solid rgba(124,58,237,0.15)" }}>
              <div style={{ fontWeight: 700, fontSize: 11, color: "#6d28d9", marginBottom: 6 }}>★ Final answer</div>
              <div style={{ fontSize: 12, lineHeight: 1.6, color: "#1e293b" }}>
                {!showFull && data.run.finalContent.length > 500
                  ? <>{data.run.finalContent.slice(0, 500)}<button onClick={() => setShowFull(true)} style={{ marginLeft: 4, color: "#6d28d9", fontWeight: 700, background: "none", border: "none", cursor: "pointer", fontSize: 11 }}>… Show all</button></>
                  : data.run.finalContent
                }
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CompareContent() {
  const params = useSearchParams();
  const runA = params?.get("a") || "";
  const runB = params?.get("b") || "";

  const [inputA, setInputA] = useState(runA);
  const [inputB, setInputB] = useState(runB);
  const [dataA, setDataA] = useState<RunData | null>(null);
  const [dataB, setDataB] = useState<RunData | null>(null);
  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRun = useCallback(async (id: string, setter: (d: RunData | null) => void, setLoading: (b: boolean) => void) => {
    if (!id.trim()) { setter(null); return; }
    setLoading(true);
    setError(null);
    try {
      const [runRes, costRes] = await Promise.all([
        fetch(apiUrl(`/api/qcoreai/runs/${id.trim()}`), { headers: bearerHeader() }),
        fetch(apiUrl(`/api/qcoreai/runs/${id.trim()}/cost-breakdown`), { headers: bearerHeader() }),
      ]);
      const runData = await runRes.json().catch(() => ({}));
      if (!runRes.ok) throw new Error(runData?.error || `HTTP ${runRes.status}`);
      const costData = await costRes.json().catch(() => ({}));
      setter({
        run: runData.run || runData,
        breakdown: costData.breakdown || [],
        totalCostUsd: costData.totalCostUsd ?? 0,
      });
    } catch (e: any) {
      setError(e?.message || "Failed to load run");
      setter(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (runA) fetchRun(runA, setDataA, setLoadingA); }, [runA, fetchRun]);
  useEffect(() => { if (runB) fetchRun(runB, setDataB, setLoadingB); }, [runB, fetchRun]);

  const load = () => {
    const url = new URL(window.location.href);
    if (inputA.trim()) url.searchParams.set("a", inputA.trim()); else url.searchParams.delete("a");
    if (inputB.trim()) url.searchParams.set("b", inputB.trim()); else url.searchParams.delete("b");
    window.history.pushState({}, "", url.toString());
    fetchRun(inputA.trim(), setDataA, setLoadingA);
    fetchRun(inputB.trim(), setDataB, setLoadingB);
  };

  // Diff summary
  const costDiff = dataA && dataB ? dataB.totalCostUsd - dataA.totalCostUsd : null;
  const durDiff = dataA?.run.totalDurationMs != null && dataB?.run.totalDurationMs != null
    ? dataB.run.totalDurationMs - dataA.run.totalDurationMs : null;

  return (
    <>
      {/* ID inputs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          placeholder="Run A ID or share token"
          value={inputA}
          onChange={(e) => setInputA(e.target.value)}
          style={{ flex: 1, minWidth: 200, padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, outline: "none" }}
        />
        <span style={{ alignSelf: "center", color: "#94a3b8", fontWeight: 700 }}>vs</span>
        <input
          placeholder="Run B ID or share token"
          value={inputB}
          onChange={(e) => setInputB(e.target.value)}
          style={{ flex: 1, minWidth: 200, padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, outline: "none" }}
        />
        <button
          onClick={load}
          style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#0f172a", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
        >
          Compare
        </button>
      </div>

      {error && (
        <div style={{ marginBottom: 12, padding: "8px 12px", borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#991b1b", fontSize: 12 }}>
          {error}
        </div>
      )}

      {/* Diff summary */}
      {dataA && dataB && (
        <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          {costDiff !== null && (
            <span style={{
              padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 800,
              background: costDiff > 0 ? "rgba(239,68,68,0.08)" : "rgba(16,185,129,0.08)",
              color: costDiff > 0 ? "#991b1b" : "#065f46",
              border: `1px solid ${costDiff > 0 ? "rgba(239,68,68,0.2)" : "rgba(16,185,129,0.2)"}`,
            }}>
              Cost: {costDiff > 0 ? "+" : ""}{fmt$(Math.abs(costDiff))} {costDiff > 0 ? "▲ B more expensive" : "▼ B cheaper"}
            </span>
          )}
          {durDiff !== null && (
            <span style={{
              padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 800,
              background: durDiff > 0 ? "rgba(245,158,11,0.08)" : "rgba(16,185,129,0.08)",
              color: durDiff > 0 ? "#92400e" : "#065f46",
              border: `1px solid ${durDiff > 0 ? "rgba(245,158,11,0.2)" : "rgba(16,185,129,0.2)"}`,
            }}>
              Duration: {fmtMs(Math.abs(durDiff))} {durDiff > 0 ? "▲ B slower" : "▼ B faster"}
            </span>
          )}
        </div>
      )}

      {/* Side-by-side columns */}
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <CompareCol label="Run A" data={dataA} loading={loadingA} />
        <div style={{ width: 1, background: "#e2e8f0", alignSelf: "stretch" }} />
        <CompareCol label="Run B" data={dataB} loading={loadingB} />
      </div>
    </>
  );
}

export default function ComparePage() {
  return (
    <main>
      <Wave1Nav />
      <ProductPageShell>
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", margin: 0 }}>⚖️ Run Compare</h1>
            <Link href="/qcoreai/multi" style={{ fontSize: 12, color: "#4338ca", fontWeight: 700, textDecoration: "none" }}>← Multi-agent</Link>
          </div>
          <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>
            Compare two runs side-by-side — cost, duration, per-agent breakdown, and final answers. Use URL params ?a=runId&b=runId for shareable links.
          </p>
        </div>
        <Suspense fallback={<p style={{ color: "#94a3b8", fontSize: 13 }}>Loading…</p>}>
          <CompareContent />
        </Suspense>
      </ProductPageShell>
    </main>
  );
}
