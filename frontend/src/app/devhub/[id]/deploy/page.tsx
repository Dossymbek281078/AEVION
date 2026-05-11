"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Project {
  id: string;
  name: string;
  stack: string;
  status: string;
  deployUrl: string | null;
}

interface Deployment {
  id: string;
  status: "pending" | "building" | "live" | "failed" | string;
  deployUrl: string | null;
  buildLog: string | null;
  triggeredAt: string;
  completedAt: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; dot: string; text: string }> = {
  pending:  { label: "Pending",  dot: "#f59e0b", text: "#fef3c7" },
  building: { label: "Building", dot: "#3b82f6", text: "#dbeafe" },
  live:     { label: "Live",     dot: "#22c55e", text: "#dcfce7" },
  failed:   { label: "Failed",   dot: "#ef4444", text: "#fee2e2" },
};

function statusMeta(s: string) {
  return STATUS_META[s] ?? { label: s, dot: "#94a3b8", text: "#f1f5f9" };
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

function durationStr(start: string, end: string | null): string {
  if (!end) return "";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const m = statusMeta(status);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 20, padding: "3px 12px", fontSize: 12, fontWeight: 600,
      color: m.dot, letterSpacing: "0.04em",
    }}>
      <span style={{
        width: 7, height: 7, borderRadius: "50%", background: m.dot,
        boxShadow: status === "building" || status === "pending"
          ? `0 0 6px 2px ${m.dot}99` : "none",
        animation: status === "building" || status === "pending"
          ? "pulse-dot 1.4s ease-in-out infinite" : "none",
        display: "inline-block", flexShrink: 0,
      }} />
      {m.label}
    </span>
  );
}

function TerminalPanel({ logs, label }: { logs: string; label?: string }) {
  const ref = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div style={{
      background: "#0a0e1a", border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 10, overflow: "hidden",
    }}>
      {/* Terminal header bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)",
        background: "rgba(255,255,255,0.03)",
      }}>
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444", display: "inline-block" }} />
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#f59e0b", display: "inline-block" }} />
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
        {label && (
          <span style={{ marginLeft: 8, fontSize: 11, color: "#64748b", fontFamily: "monospace" }}>
            {label}
          </span>
        )}
      </div>
      <pre
        ref={ref}
        style={{
          margin: 0, padding: "16px 18px",
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace",
          fontSize: 12, lineHeight: 1.7, color: "#a3e635",
          maxHeight: 320, overflowY: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word",
          background: "transparent",
        }}
      >
        {logs || "— no logs yet —"}
      </pre>
    </div>
  );
}

function DeploymentRow({
  d,
  isActive,
  onClick,
}: {
  d: Deployment;
  isActive: boolean;
  onClick: () => void;
}) {
  const m = statusMeta(d.status);
  const dur = durationStr(d.triggeredAt, d.completedAt);

  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        width: "100%", textAlign: "left",
        padding: "10px 14px",
        background: isActive ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.02)",
        border: `1px solid ${isActive ? "rgba(99,102,241,0.35)" : "rgba(255,255,255,0.07)"}`,
        borderRadius: 8, cursor: "pointer",
        transition: "background 0.15s, border-color 0.15s",
      }}
    >
      {/* Status dot */}
      <span style={{
        width: 9, height: 9, borderRadius: "50%", background: m.dot,
        flexShrink: 0, marginTop: 1,
        boxShadow: d.status === "building" || d.status === "pending"
          ? `0 0 5px 2px ${m.dot}99` : "none",
      }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: "#94a3b8", fontFamily: "monospace" }}>
          #{d.id.slice(0, 8)}
        </div>
        <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
          {relativeTime(d.triggeredAt)}
          {dur && <span style={{ marginLeft: 8, color: "#475569" }}>{dur}</span>}
        </div>
      </div>

      <StatusBadge status={d.status} />
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DevHubDeployPage({ params }: { params: { id: string } }) {
  const { id } = params;

  const [project, setProject] = useState<Project | null>(null);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [selectedDeployment, setSelectedDeployment] = useState<Deployment | null>(null);
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Toast helper ─────────────────────────────────────────────────────────
  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Fetch latest data ─────────────────────────────────────────────────────
  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [projRes, deplRes] = await Promise.all([
        fetch(apiUrl(`/api/devhub/projects/${id}`), { cache: "no-store" }),
        fetch(apiUrl(`/api/devhub/projects/${id}/deployments`), { cache: "no-store" }),
      ]);

      if (!projRes.ok) throw new Error("Project not found");
      const projData = await projRes.json();
      setProject(projData.project);

      if (deplRes.ok) {
        const deplData = await deplRes.json();
        const list: Deployment[] = deplData.deployments || [];
        setDeployments(list);

        // Keep selected deployment in sync
        setSelectedDeployment((prev) => {
          if (!prev && list.length > 0) return list[0];
          if (prev) {
            const updated = list.find((d) => d.id === prev.id);
            return updated ?? prev;
          }
          return prev;
        });
      }
    } catch (e: any) {
      if (!silent) setError(e?.message || "Failed to load");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [id]);

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Auto-refresh while any deployment is in progress ─────────────────────
  const hasInProgress = deployments.some(
    (d) => d.status === "pending" || d.status === "building"
  );

  useEffect(() => {
    if (hasInProgress) {
      pollingRef.current = setInterval(() => fetchData(true), 3000);
    } else {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [hasInProgress, fetchData]);

  // ── Trigger deploy ────────────────────────────────────────────────────────
  const handleDeploy = async () => {
    setDeploying(true);
    try {
      const r = await fetch(apiUrl(`/api/devhub/projects/${id}/deploy`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error || "Deploy failed");
      }
      showToast("Deployment started", true);
      // Immediately refresh so the new pending deployment appears
      await fetchData(true);
    } catch (e: any) {
      showToast(e?.message || "Deploy failed", false);
    } finally {
      setDeploying(false);
    }
  };

  // ── Render: loading ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#020617", display: "flex", flexDirection: "column" }}>
        <Wave1Nav />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", fontSize: 14 }}>
          Loading…
        </div>
      </div>
    );
  }

  // ── Render: error ─────────────────────────────────────────────────────────
  if (error || !project) {
    return (
      <div style={{ minHeight: "100vh", background: "#020617", display: "flex", flexDirection: "column" }}>
        <Wave1Nav />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
          <div style={{ color: "#ef4444", fontSize: 15 }}>{error || "Project not found"}</div>
          <Link href="/devhub" style={{ color: "#6366f1", fontSize: 13, textDecoration: "underline" }}>
            Back to DevHub
          </Link>
        </div>
      </div>
    );
  }

  const latestDeployment = deployments[0] ?? null;
  const liveUrl = project.deployUrl ?? latestDeployment?.deployUrl ?? null;

  return (
    <>
      {/* Pulse-dot animation */}
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#020617", display: "flex", flexDirection: "column" }}>
        <Wave1Nav />

        <div style={{ flex: 1, maxWidth: 1120, margin: "0 auto", width: "100%", padding: "32px 20px 60px" }}>

          {/* ── Breadcrumb ── */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 24, fontSize: 13, color: "#475569" }}>
            <Link href="/devhub" style={{ color: "#6366f1", textDecoration: "none" }}>DevHub</Link>
            <span>/</span>
            <Link href={`/devhub/${id}`} style={{ color: "#6366f1", textDecoration: "none" }}>
              {project.name}
            </Link>
            <span>/</span>
            <span style={{ color: "#94a3b8" }}>Deploy</span>
          </div>

          {/* ── Header row ── */}
          <div style={{
            display: "flex", alignItems: "flex-start", justifyContent: "space-between",
            flexWrap: "wrap", gap: 16, marginBottom: 32,
          }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#f1f5f9" }}>
                {project.name}
              </h1>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                <StatusBadge status={project.status} />
                <span style={{ fontSize: 12, color: "#475569", fontFamily: "monospace" }}>
                  {project.stack}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {liveUrl && (
                <a
                  href={liveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "8px 16px", borderRadius: 8,
                    background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)",
                    color: "#4ade80", fontSize: 13, fontWeight: 600, textDecoration: "none",
                    transition: "background 0.15s",
                  }}
                >
                  <span style={{ fontSize: 10 }}>&#9679;</span>
                  View Live
                </a>
              )}

              <button
                onClick={handleDeploy}
                disabled={deploying || hasInProgress}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "9px 20px", borderRadius: 8,
                  background: deploying || hasInProgress
                    ? "rgba(99,102,241,0.3)"
                    : "linear-gradient(135deg, #6366f1, #8b5cf6)",
                  border: "1px solid rgba(99,102,241,0.4)",
                  color: deploying || hasInProgress ? "#a5b4fc" : "#fff",
                  fontSize: 13, fontWeight: 700, cursor: deploying || hasInProgress ? "not-allowed" : "pointer",
                  transition: "opacity 0.15s",
                  opacity: deploying ? 0.7 : 1,
                }}
              >
                {deploying ? (
                  <>
                    <span style={{
                      display: "inline-block", width: 12, height: 12,
                      border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff",
                      borderRadius: "50%", animation: "spin 0.75s linear infinite",
                    }} />
                    Deploying…
                  </>
                ) : hasInProgress ? (
                  "Build in progress…"
                ) : (
                  "Deploy"
                )}
              </button>
            </div>
          </div>

          {/* ── Live URL banner ── */}
          {liveUrl && project.status === "live" && (
            <div style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "14px 18px", marginBottom: 28,
              background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.2)",
              borderRadius: 10,
            }}>
              <span style={{ color: "#22c55e", fontSize: 16 }}>&#10003;</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: "#86efac", fontWeight: 600 }}>Deployed</div>
                <a
                  href={liveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: 13, color: "#4ade80", fontFamily: "monospace",
                    textDecoration: "none", wordBreak: "break-all",
                  }}
                >
                  {liveUrl}
                </a>
              </div>
            </div>
          )}

          {/* ── Main grid: history + logs ── */}
          <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20, alignItems: "start" }}>

            {/* ── Left: deployment history ── */}
            <div>
              <div style={{ fontSize: 11, color: "#475569", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
                Deployment History
              </div>

              {deployments.length === 0 ? (
                <div style={{
                  padding: "24px 16px", textAlign: "center",
                  color: "#475569", fontSize: 13,
                  background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10,
                }}>
                  No deployments yet.
                  <br />
                  <span style={{ fontSize: 12, color: "#334155", marginTop: 4, display: "block" }}>
                    Click Deploy to start.
                  </span>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {deployments.map((d) => (
                    <DeploymentRow
                      key={d.id}
                      d={d}
                      isActive={selectedDeployment?.id === d.id}
                      onClick={() => setSelectedDeployment(d)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* ── Right: selected deployment detail ── */}
            <div>
              {selectedDeployment ? (
                <>
                  {/* Detail header */}
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    flexWrap: "wrap", gap: 10, marginBottom: 14,
                    padding: "12px 16px",
                    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <StatusBadge status={selectedDeployment.status} />
                      <span style={{ fontSize: 12, color: "#64748b", fontFamily: "monospace" }}>
                        #{selectedDeployment.id.slice(0, 12)}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 20, fontSize: 12, color: "#64748b" }}>
                      <span>
                        Started: <span style={{ color: "#94a3b8" }}>{relativeTime(selectedDeployment.triggeredAt)}</span>
                      </span>
                      {selectedDeployment.completedAt && (
                        <span>
                          Duration:{" "}
                          <span style={{ color: "#94a3b8" }}>
                            {durationStr(selectedDeployment.triggeredAt, selectedDeployment.completedAt)}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Deploy URL for this deployment */}
                  {selectedDeployment.deployUrl && (
                    <div style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 14px", marginBottom: 14,
                      background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.2)",
                      borderRadius: 8,
                    }}>
                      <span style={{ fontSize: 11, color: "#818cf8", fontWeight: 600, flexShrink: 0 }}>URL</span>
                      <a
                        href={selectedDeployment.deployUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 12, color: "#a5b4fc", fontFamily: "monospace", textDecoration: "none", wordBreak: "break-all" }}
                      >
                        {selectedDeployment.deployUrl}
                      </a>
                    </div>
                  )}

                  {/* Build log terminal */}
                  <div style={{ fontSize: 11, color: "#475569", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                    Build Log
                  </div>
                  <TerminalPanel
                    logs={selectedDeployment.buildLog || ""}
                    label={`build-${selectedDeployment.id.slice(0, 8)}.log`}
                  />

                  {/* Building indicator */}
                  {(selectedDeployment.status === "pending" || selectedDeployment.status === "building") && (
                    <div style={{
                      display: "flex", alignItems: "center", gap: 8,
                      marginTop: 12, fontSize: 12, color: "#3b82f6",
                    }}>
                      <span style={{
                        display: "inline-block", width: 10, height: 10,
                        border: "2px solid rgba(59,130,246,0.3)", borderTopColor: "#3b82f6",
                        borderRadius: "50%",
                        animation: "spin 0.75s linear infinite",
                      }} />
                      Build in progress — auto-refreshing every 3s
                    </div>
                  )}
                </>
              ) : (
                <div style={{
                  padding: "40px 20px", textAlign: "center",
                  color: "#334155", fontSize: 13,
                  background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 10,
                }}>
                  Select a deployment on the left to view its build log.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Toast ── */}
        {toast && (
          <div style={{
            position: "fixed", bottom: 24, right: 24, zIndex: 999,
            padding: "12px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600,
            background: toast.ok ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
            border: `1px solid ${toast.ok ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.35)"}`,
            color: toast.ok ? "#4ade80" : "#f87171",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            display: "flex", alignItems: "center", gap: 10, maxWidth: 360,
          }}>
            <span>{toast.msg}</span>
            <button
              onClick={() => setToast(null)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", fontWeight: 800, fontSize: 16, lineHeight: 1 }}
            >
              ×
            </button>
          </div>
        )}

        {/* Spinner keyframe */}
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </>
  );
}
