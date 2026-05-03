"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ProductPageShell } from "@/components/ProductPageShell";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

function bearerHeader(): HeadersInit {
  if (typeof window === "undefined") return {};
  const t = localStorage.getItem("aevion_token") || sessionStorage.getItem("aevion_token");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

type Batch = {
  id: string; strategy: string; status: "running" | "done" | "error";
  totalRuns: number; completedRuns: number; failedRuns: number;
  totalCostUsd: number; createdAt: string; completedAt: string | null;
};

type RunSummary = {
  id: string; userInput: string; status: string;
  totalCostUsd: number | null; finalContentPreview: string | null;
  startedAt: string; finishedAt: string | null;
};

type FullRun = {
  id: string; userInput: string; status: string;
  totalCostUsd: number | null; totalDurationMs: number | null;
  finalContent: string | null; startedAt: string; finishedAt: string | null;
};

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  running: { bg: "rgba(13,148,136,0.1)", color: "#0f766e", label: "⏳ Running" },
  done:    { bg: "rgba(16,185,129,0.1)", color: "#065f46", label: "✓ Done" },
  error:   { bg: "rgba(239,68,68,0.08)", color: "#991b1b", label: "✕ Error" },
  pending: { bg: "rgba(148,163,184,0.12)", color: "#475569", label: "… Pending" },
  stopped: { bg: "rgba(245,158,11,0.1)", color: "#92400e", label: "⏹ Stopped" },
};

function fmt$(n: number | null | undefined) {
  if (!n) return null;
  return `$${n.toFixed(4)}`;
}

function fmtMs(ms: number | null | undefined) {
  if (!ms) return null;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function Markdown({ source }: { source: string }) {
  const lines = source.split("\n");
  return (
    <div style={{ fontSize: 13, lineHeight: 1.65, color: "#1e293b" }}>
      {lines.map((line, i) => {
        if (line.startsWith("### ")) return <h3 key={i} style={{ margin: "12px 0 4px", fontSize: 14, fontWeight: 800 }}>{line.slice(4)}</h3>;
        if (line.startsWith("## ")) return <h2 key={i} style={{ margin: "14px 0 6px", fontSize: 15, fontWeight: 900 }}>{line.slice(3)}</h2>;
        if (line.startsWith("# ")) return <h1 key={i} style={{ margin: "16px 0 8px", fontSize: 17, fontWeight: 900 }}>{line.slice(2)}</h1>;
        if (line.startsWith("- ") || line.startsWith("* ")) {
          return <div key={i} style={{ paddingLeft: 16, marginBottom: 2 }}>• {line.slice(2)}</div>;
        }
        if (!line.trim()) return <div key={i} style={{ height: 8 }} />;
        return <div key={i} style={{ marginBottom: 2 }}>{line}</div>;
      })}
    </div>
  );
}

export default function BatchDetailPage() {
  const params = useParams();
  const batchId = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";

  const [batch, setBatch] = useState<Batch | null>(null);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [fullRuns, setFullRuns] = useState<Record<string, FullRun>>({});
  const [loadingFull, setLoadingFull] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadBatch = useCallback(async () => {
    if (!batchId) return;
    try {
      const res = await fetch(apiUrl(`/api/qcoreai/batch/${batchId}`), { headers: bearerHeader() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || `HTTP ${res.status}`); return; }
      setBatch(data.batch);
      setRuns(data.runs || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load batch");
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => { loadBatch(); }, [loadBatch]);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (batch?.status === "running") {
      pollRef.current = setInterval(loadBatch, 3000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [batch?.status, loadBatch]);

  const expandRun = async (runId: string) => {
    if (fullRuns[runId] || loadingFull[runId]) return;
    setLoadingFull((p) => ({ ...p, [runId]: true }));
    try {
      const res = await fetch(apiUrl(`/api/qcoreai/runs/${runId}`), { headers: bearerHeader() });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.run) setFullRuns((p) => ({ ...p, [runId]: data.run }));
    } finally {
      setLoadingFull((p) => ({ ...p, [runId]: false }));
    }
  };

  if (loading) {
    return (
      <main>
        <Wave1Nav />
        <ProductPageShell>
          <p style={{ color: "#94a3b8", fontSize: 13 }}>Loading…</p>
        </ProductPageShell>
      </main>
    );
  }

  if (error || !batch) {
    return (
      <main>
        <Wave1Nav />
        <ProductPageShell>
          <p style={{ color: "#dc2626", fontSize: 13 }}>{error || "Batch not found"}</p>
          <Link href="/qcoreai/batch" style={{ color: "#4338ca", fontSize: 13 }}>← Back to batches</Link>
        </ProductPageShell>
      </main>
    );
  }

  const done = batch.completedRuns + batch.failedRuns;
  const pct = batch.totalRuns > 0 ? Math.round((done / batch.totalRuns) * 100) : 0;
  const barColor = batch.status === "error" ? "#ef4444" : batch.status === "done" ? "#10b981" : "#4338ca";

  return (
    <main>
      <Wave1Nav />
      <ProductPageShell>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <Link href="/qcoreai/batch" style={{ fontSize: 12, color: "#4338ca", textDecoration: "none", fontWeight: 700 }}>
            ← Batch runs
          </Link>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: "#0f172a", margin: "8px 0 2px" }}>
            Batch <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 16 }}>{batchId.slice(0, 12)}…</span>
          </h1>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 999,
                background: STATUS_STYLE[batch.status]?.bg, color: STATUS_STYLE[batch.status]?.color,
              }}
            >
              {STATUS_STYLE[batch.status]?.label}
            </span>
            <span style={{ fontSize: 12, color: "#475569" }}>
              {batch.completedRuns}/{batch.totalRuns} done
              {batch.failedRuns > 0 && <span style={{ color: "#dc2626" }}> · {batch.failedRuns} failed</span>}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>
              Total: ${batch.totalCostUsd.toFixed(4)}
            </span>
            {batch.status === "running" && (
              <span style={{ fontSize: 11, color: "#4338ca", fontWeight: 700 }}>Auto-refresh 3s</span>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ height: 8, borderRadius: 4, background: "#f1f5f9", overflow: "hidden", marginBottom: 24 }}>
          <div style={{ height: "100%", borderRadius: 4, background: barColor, width: `${pct}%`, transition: "width 0.6s" }} />
        </div>

        {/* Run list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {runs.map((r, i) => {
            const ss = STATUS_STYLE[r.status] || STATUS_STYLE.pending;
            const full = fullRuns[r.id];
            const isLoading = loadingFull[r.id];
            const expanded = !!full;

            return (
              <div
                key={r.id}
                style={{
                  borderRadius: 14, border: "1px solid rgba(15,23,42,0.1)",
                  background: "#fff", overflow: "hidden",
                }}
              >
                {/* Run header */}
                <div
                  style={{
                    padding: "12px 16px", display: "flex", alignItems: "flex-start", gap: 10,
                    cursor: r.status === "done" || r.status === "stopped" ? "pointer" : "default",
                  }}
                  onClick={() => {
                    if (r.status === "done" || r.status === "stopped") {
                      if (!expanded) expandRun(r.id);
                      else setFullRuns((p) => { const n = { ...p }; delete n[r.id]; return n; });
                    }
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 900, color: "#94a3b8", minWidth: 24 }}>#{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 999, background: ss.bg, color: ss.color }}>
                        {ss.label}
                      </span>
                      {r.totalCostUsd != null && r.totalCostUsd > 0 && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#0f172a" }}>{fmt$(r.totalCostUsd)}</span>
                      )}
                      {r.finishedAt && r.startedAt && (
                        <span style={{ fontSize: 10, color: "#94a3b8" }}>
                          {fmtMs(new Date(r.finishedAt).getTime() - new Date(r.startedAt).getTime())}
                        </span>
                      )}
                      <Link
                        href={`/qcoreai/multi?runId=${r.id}`}
                        onClick={(e) => e.stopPropagation()}
                        style={{ fontSize: 10, color: "#4338ca", fontWeight: 700, textDecoration: "none", marginLeft: "auto" }}
                      >
                        Open in multi ↗
                      </Link>
                    </div>
                    <div style={{ fontSize: 13, color: "#0f172a", fontWeight: 600, marginBottom: 4 }}>
                      {r.userInput}
                    </div>
                    {/* Preview when not expanded */}
                    {!expanded && r.finalContentPreview && (
                      <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.5 }}>
                        {r.finalContentPreview.length > 250 ? r.finalContentPreview.slice(0, 250) + "…" : r.finalContentPreview}
                        {(r.status === "done" || r.status === "stopped") && (
                          <span style={{ color: "#4338ca", fontWeight: 700, marginLeft: 6, fontSize: 11 }}>
                            {isLoading ? "Loading…" : "Show full ↓"}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Full content */}
                {full && (
                  <div
                    style={{
                      padding: "0 16px 16px 50px",
                      borderTop: "1px solid rgba(15,23,42,0.06)",
                      paddingTop: 12,
                    }}
                  >
                    {full.finalContent ? (
                      <div
                        style={{
                          padding: 14, borderRadius: 10,
                          background: "rgba(124,58,237,0.04)",
                          border: "1px solid rgba(124,58,237,0.15)",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 800, color: "#6d28d9" }}>★ Final answer</span>
                          <button
                            onClick={async () => {
                              try { await navigator.clipboard.writeText(full.finalContent!); } catch {}
                            }}
                            style={{
                              marginLeft: "auto", padding: "3px 8px", borderRadius: 6,
                              border: "1px solid rgba(124,58,237,0.3)", background: "#fff",
                              color: "#6d28d9", fontSize: 10, fontWeight: 700, cursor: "pointer",
                            }}
                          >
                            Copy
                          </button>
                        </div>
                        <Markdown source={full.finalContent} />
                      </div>
                    ) : (
                      <p style={{ fontSize: 12, color: "#94a3b8" }}>No final content for this run.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {runs.length === 0 && (
          <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", marginTop: 40 }}>
            No runs yet — batch may still be initializing.
          </p>
        )}
      </ProductPageShell>
    </main>
  );
}
