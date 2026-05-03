"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ProductPageShell } from "@/components/ProductPageShell";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

function bearerHeader(): HeadersInit {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("aevion_token") || sessionStorage.getItem("aevion_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/* ═══════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════ */

type Strategy = "sequential" | "parallel" | "debate";

type Batch = {
  id: string;
  strategy: Strategy;
  status: "running" | "done" | "error";
  totalRuns: number;
  completedRuns: number;
  failedRuns: number;
  totalCostUsd: number;
  inputs: string[];
  createdAt: string;
  completedAt: string | null;
};

type RunSummary = {
  id: string;
  userInput: string;
  status: string;
  totalCostUsd: number | null;
  finalContentPreview: string | null;
  startedAt: string;
  finishedAt: string | null;
};

type BatchDetail = { batch: Batch; runs: RunSummary[] };

/* ═══════════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════════ */

const MAX_INPUTS = 20;

function fmt$(n: number | null | undefined) {
  if (!n) return "—";
  return `$${n.toFixed(4)}`;
}

function formatAgo(iso: string) {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

const STRAT_COLOR: Record<Strategy, string> = {
  sequential: "#0d9488",
  parallel: "#4338ca",
  debate: "#7c3aed",
};

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  running: { bg: "rgba(13,148,136,0.1)", color: "#0f766e", label: "⏳ Running" },
  done:    { bg: "rgba(16,185,129,0.1)", color: "#065f46", label: "✓ Done" },
  error:   { bg: "rgba(239,68,68,0.08)", color: "#991b1b", label: "✕ Error" },
  pending: { bg: "rgba(148,163,184,0.12)", color: "#475569", label: "… Pending" },
  stopped: { bg: "rgba(245,158,11,0.1)", color: "#92400e", label: "⏹ Stopped" },
};

/* ═══════════════════════════════════════════════════════════════════════
   Page
   ═══════════════════════════════════════════════════════════════════════ */

export default function BatchPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selected, setSelected] = useState<BatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form
  const [inputsText, setInputsText] = useState("");
  const [strategy, setStrategy] = useState<Strategy>("sequential");
  const [maxCostUsd, setMaxCostUsd] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Load batch list ── */
  const loadBatches = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/qcoreai/batches"), { headers: bearerHeader() });
      const data = await res.json().catch(() => ({}));
      if (Array.isArray(data?.items)) setBatches(data.items);
    } catch (e: any) {
      setError(e?.message || "Failed to load batches");
    } finally {
      setLoading(false);
    }
  }, []);

  /* ── Load batch detail ── */
  const loadDetail = useCallback(async (id: string) => {
    try {
      const res = await fetch(apiUrl(`/api/qcoreai/batch/${id}`), { headers: bearerHeader() });
      const data = await res.json().catch(() => ({}));
      if (data?.batch) {
        setSelected(data as BatchDetail);
        // Update list too
        setBatches((prev) => prev.map((b) => (b.id === id ? data.batch : b)));
      }
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  /* ── Poll selected batch while running ── */
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (selected?.batch.status === "running") {
      pollRef.current = setInterval(() => loadDetail(selected.batch.id), 3000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selected?.batch.id, selected?.batch.status, loadDetail]);

  /* ── Submit new batch ── */
  const submit = async () => {
    const lines = inputsText.split(/\n---\n|\n/).map((s) => s.trim()).filter(Boolean);
    if (lines.length === 0) return;
    if (lines.length > MAX_INPUTS) {
      setError(`Maximum ${MAX_INPUTS} prompts per batch (you provided ${lines.length}).`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { inputs: lines, strategy };
      if (maxCostUsd > 0) body.maxCostUsd = maxCostUsd;
      const res = await fetch(apiUrl("/api/qcoreai/batch"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...bearerHeader() },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      // Optimistically add to list
      setBatches((prev) => [
        {
          id: data.batchId,
          strategy,
          status: "running",
          totalRuns: lines.length,
          completedRuns: 0,
          failedRuns: 0,
          totalCostUsd: 0,
          inputs: lines,
          createdAt: new Date().toISOString(),
          completedAt: null,
        },
        ...prev,
      ]);
      setInputsText("");
      // Auto-select the new batch
      setTimeout(() => loadDetail(data.batchId), 500);
    } catch (e: any) {
      setError(e?.message || "Batch creation failed");
    } finally {
      setSubmitting(false);
    }
  };

  const parsedInputs = inputsText.split(/\n---\n|\n/).map((s) => s.trim()).filter(Boolean);
  const validCount = Math.min(parsedInputs.length, MAX_INPUTS);

  return (
    <main>
      <Wave1Nav />
      <ProductPageShell>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", margin: 0 }}>⚡ Batch Runs</h1>
          <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>
            Submit multiple prompts against a shared agent config — up to {MAX_INPUTS} prompts, 5 at a time.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20, alignItems: "start" }}>

          {/* ── Left: create form + batch list ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Create form */}
            <div
              style={{
                borderRadius: 14, border: "1px solid rgba(15,23,42,0.12)",
                background: "#fff", padding: 16,
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 10, color: "#0f172a" }}>
                New batch
              </div>

              <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>
                Prompts — one per line, or separate with a line containing only <code>---</code>
              </label>
              <textarea
                value={inputsText}
                onChange={(e) => setInputsText(e.target.value)}
                placeholder={"Summarise the Q1 report\nCompare GPT-4o vs Claude Sonnet\nDraft a pitch for the AI investor deck"}
                rows={7}
                style={{
                  width: "100%", padding: "8px 10px", borderRadius: 8, resize: "vertical",
                  border: "1px solid rgba(15,23,42,0.15)", fontSize: 12, fontFamily: "inherit",
                  outline: "none", background: "#f8fafc", boxSizing: "border-box",
                }}
              />
              {parsedInputs.length > 0 && (
                <div style={{ fontSize: 11, color: parsedInputs.length > MAX_INPUTS ? "#dc2626" : "#64748b", marginTop: 4 }}>
                  {parsedInputs.length > MAX_INPUTS
                    ? `⚠ ${parsedInputs.length} prompts — max ${MAX_INPUTS}. Only the first ${MAX_INPUTS} will run.`
                    : `${validCount} prompt${validCount !== 1 ? "s" : ""} ready`}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
                <select
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value as Strategy)}
                  style={{
                    padding: "5px 8px", borderRadius: 8, border: "1px solid #cbd5e1",
                    fontSize: 12, background: "#fff", fontFamily: "inherit",
                  }}
                >
                  <option value="sequential">Sequential</option>
                  <option value="parallel">Parallel</option>
                  <option value="debate">Debate</option>
                </select>
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={maxCostUsd || ""}
                  onChange={(e) => setMaxCostUsd(parseFloat(e.target.value) || 0)}
                  placeholder="Max $/run"
                  style={{
                    width: 90, padding: "5px 8px", borderRadius: 8, border: "1px solid #cbd5e1",
                    fontSize: 12, fontFamily: "inherit",
                  }}
                />
                <button
                  onClick={submit}
                  disabled={submitting || validCount === 0}
                  style={{
                    flex: 1, padding: "6px 14px", borderRadius: 8, border: "none",
                    background: validCount === 0 ? "#94a3b8" : "#4338ca",
                    color: "#fff", fontSize: 12, fontWeight: 800,
                    cursor: validCount === 0 ? "default" : "pointer", whiteSpace: "nowrap",
                  }}
                >
                  {submitting ? "Submitting…" : `Run ${validCount} prompt${validCount !== 1 ? "s" : ""}`}
                </button>
              </div>
            </div>

            {/* Batch list */}
            <div>
              <div style={{ fontWeight: 700, fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
                Recent batches
              </div>
              {loading ? (
                <p style={{ fontSize: 12, color: "#94a3b8" }}>Loading…</p>
              ) : batches.length === 0 ? (
                <p style={{ fontSize: 12, color: "#94a3b8" }}>No batches yet.</p>
              ) : (
                batches.map((b) => {
                  const ss = STATUS_STYLE[b.status] || STATUS_STYLE.pending;
                  const isActive = selected?.batch.id === b.id;
                  return (
                    <div
                      key={b.id}
                      onClick={() => loadDetail(b.id)}
                      style={{
                        marginBottom: 6, padding: "8px 12px", borderRadius: 10, cursor: "pointer",
                        border: isActive ? "1px solid #4338ca" : "1px solid rgba(15,23,42,0.1)",
                        background: isActive ? "rgba(67,56,202,0.06)" : "#fff",
                        display: "flex", flexDirection: "column", gap: 4,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span
                          style={{
                            fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 999,
                            background: ss.bg, color: ss.color,
                          }}
                        >
                          {ss.label}
                        </span>
                        <span
                          style={{
                            fontSize: 10, padding: "2px 7px", borderRadius: 999, fontWeight: 700,
                            background: `${STRAT_COLOR[b.strategy] || "#475569"}22`,
                            color: STRAT_COLOR[b.strategy] || "#475569",
                          }}
                        >
                          {b.strategy}
                        </span>
                        <span style={{ marginLeft: "auto", fontSize: 10, color: "#94a3b8" }}>
                          {formatAgo(b.createdAt)}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: "#475569" }}>
                        {b.completedRuns}/{b.totalRuns} done
                        {b.failedRuns > 0 && <span style={{ color: "#dc2626" }}> · {b.failedRuns} failed</span>}
                        <span style={{ marginLeft: 6, color: "#0f172a", fontWeight: 700 }}>{fmt$(b.totalCostUsd)}</span>
                      </div>
                      {/* Progress bar */}
                      <div style={{ height: 3, borderRadius: 2, background: "#f1f5f9", overflow: "hidden" }}>
                        <div
                          style={{
                            height: "100%", borderRadius: 2, transition: "width 0.5s",
                            background: b.status === "error" ? "#ef4444" : b.status === "done" ? "#10b981" : "#4338ca",
                            width: `${b.totalRuns > 0 ? Math.round(((b.completedRuns + b.failedRuns) / b.totalRuns) * 100) : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ── Right: batch detail ── */}
          {selected ? (
            <div
              style={{
                borderRadius: 14, border: "1px solid rgba(15,23,42,0.12)",
                background: "#fff", padding: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: "#0f172a", flex: 1 }}>
                  Batch {selected.batch.id.slice(0, 8)}…
                </div>
                {selected.batch.status === "running" && (
                  <span style={{ fontSize: 11, color: "#4338ca", fontWeight: 700 }}>Live · auto-refresh 3s</span>
                )}
                <span style={{ fontSize: 11, color: "#94a3b8" }}>{selected.batch.strategy}</span>
              </div>

              {/* Summary stats */}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
                {[
                  { label: "Total", value: selected.batch.totalRuns },
                  { label: "Done", value: selected.batch.completedRuns, color: "#059669" },
                  { label: "Failed", value: selected.batch.failedRuns, color: "#dc2626" },
                  { label: "Cost", value: fmt$(selected.batch.totalCostUsd) },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ textAlign: "center", minWidth: 64 }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: color || "#0f172a" }}>{value}</div>
                    <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase" }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Progress bar */}
              <div style={{ height: 6, borderRadius: 4, background: "#f1f5f9", overflow: "hidden", marginBottom: 16 }}>
                <div
                  style={{
                    height: "100%", borderRadius: 4, transition: "width 0.6s",
                    background: selected.batch.status === "error" ? "#ef4444" : selected.batch.status === "done" ? "#10b981" : "#4338ca",
                    width: `${selected.batch.totalRuns > 0
                      ? Math.round(((selected.batch.completedRuns + selected.batch.failedRuns) / selected.batch.totalRuns) * 100)
                      : 0}%`,
                  }}
                />
              </div>

              {/* Per-run list */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {selected.runs.map((r, i) => {
                  const ss = STATUS_STYLE[r.status] || STATUS_STYLE.pending;
                  return (
                    <div
                      key={r.id}
                      style={{
                        padding: "10px 12px", borderRadius: 10,
                        border: "1px solid rgba(15,23,42,0.08)", background: "#f8fafc",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: "#94a3b8" }}>#{i + 1}</span>
                        <span
                          style={{
                            fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 999,
                            background: ss.bg, color: ss.color,
                          }}
                        >
                          {ss.label}
                        </span>
                        {r.totalCostUsd != null && r.totalCostUsd > 0 && (
                          <span style={{ fontSize: 11, color: "#0f172a", fontWeight: 700, marginLeft: "auto" }}>
                            {fmt$(r.totalCostUsd)}
                          </span>
                        )}
                        <Link
                          href={`/qcoreai/multi?runId=${r.id}`}
                          style={{ fontSize: 10, color: "#4338ca", fontWeight: 700, textDecoration: "none" }}
                        >
                          View ↗
                        </Link>
                      </div>
                      <div style={{ fontSize: 12, color: "#0f172a", fontWeight: 600, marginBottom: 4 }}>
                        {r.userInput.length > 100 ? r.userInput.slice(0, 100) + "…" : r.userInput}
                      </div>
                      {r.finalContentPreview && (
                        <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.5 }}>
                          {r.finalContentPreview.length > 200 ? r.finalContentPreview.slice(0, 200) + "…" : r.finalContentPreview}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div
              style={{
                borderRadius: 14, border: "1px dashed rgba(15,23,42,0.15)",
                background: "rgba(15,23,42,0.02)", padding: 32,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#94a3b8", fontSize: 13,
              }}
            >
              Select a batch to see per-run details
            </div>
          )}
        </div>

        {error && (
          <div
            role="alert"
            style={{
              marginTop: 16, padding: "10px 14px", borderRadius: 10,
              background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
              color: "#991b1b", fontSize: 12,
              display: "flex", alignItems: "center", gap: 10,
            }}
          >
            <span style={{ flex: 1 }}>{error}</span>
            <button
              onClick={() => setError(null)}
              style={{ border: "none", background: "transparent", cursor: "pointer", color: "#991b1b", fontSize: 16, fontWeight: 700 }}
            >
              ×
            </button>
          </div>
        )}
      </ProductPageShell>
    </main>
  );
}
