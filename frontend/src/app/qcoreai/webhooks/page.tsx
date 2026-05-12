"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

/* ─── Types ─────────────────────────────────────────────────────────── */

type WebhookConfig = {
  url: string;
  hasSecret: boolean;
  createdAt: string;
  updatedAt: string;
};

type WebhookLog = {
  id: string;
  event: string;
  url: string;
  statusCode: number | null;
  durationMs: number | null;
  error: string | null;
  createdAt: string;
};

type WebhookStats = {
  total: number;
  successRate: number;
  avgLatencyMs: number;
  errorCount: number;
  period: string;
};

type WebhookEvent = {
  name: string;
  description: string;
};

/* ─── Helpers ────────────────────────────────────────────────────────── */

function bearerHeader(): HeadersInit {
  try {
    const t =
      typeof window !== "undefined"
        ? localStorage.getItem("aevion_auth_token_v1") ||
          localStorage.getItem("aevion_token") ||
          sessionStorage.getItem("aevion_token")
        : null;
    if (t) return { Authorization: `Bearer ${t}` };
  } catch {}
  return {};
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function statusBg(code: number | null, error: string | null): string {
  if (error || code === null) return "rgba(239,68,68,0.12)";
  if (code >= 200 && code < 300) return "rgba(16,185,129,0.1)";
  if (code >= 400) return "rgba(239,68,68,0.12)";
  return "rgba(245,158,11,0.1)";
}

function statusColor(code: number | null, error: string | null): string {
  if (error || code === null) return "#f87171";
  if (code >= 200 && code < 300) return "#34d399";
  if (code >= 400) return "#f87171";
  return "#fbbf24";
}

const EVENT_ICONS: Record<string, string> = {
  "run.started": "▶",
  "agent.turn": "↻",
  "run.completed": "✓",
  "session.created": "+",
  "session.archived": "□",
  "annotation.created": "✎",
};

/* ─── Styles ─────────────────────────────────────────────────────────── */

const S: Record<string, React.CSSProperties> = {
  page: {
    background: "#0b0f1a",
    minHeight: "100vh",
    fontFamily: "system-ui, -apple-system, sans-serif",
    color: "#e2e8f0",
  },
  inner: { maxWidth: 860, margin: "0 auto", padding: "24px 16px 48px" },

  headerCard: {
    background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%, #0f2d3d 100%)",
    borderRadius: 16,
    padding: "24px 24px 20px",
    border: "1px solid rgba(99,102,241,0.25)",
    marginBottom: 20,
    boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
  },
  headerRow: { display: "flex", alignItems: "center", gap: 14, marginBottom: 10 },
  iconBox: {
    width: 44, height: 44, borderRadius: 12,
    background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 20, flexShrink: 0,
    boxShadow: "0 0 16px rgba(124,58,237,0.3)",
  },
  h1: { margin: 0, fontSize: 20, fontWeight: 900, letterSpacing: "-0.02em", color: "#f1f5f9" },
  subtitle: { margin: "2px 0 0", fontSize: 12, color: "rgba(226,232,240,0.6)" },
  backBtn: {
    marginLeft: "auto",
    padding: "7px 14px",
    borderRadius: 8,
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "#94a3b8",
    textDecoration: "none",
    fontSize: 12,
    fontWeight: 600,
    whiteSpace: "nowrap" as const,
    flexShrink: 0,
  },
  headerNote: { margin: 0, fontSize: 12, color: "rgba(226,232,240,0.55)", lineHeight: 1.6 },

  tabBar: { display: "flex", gap: 4, marginBottom: 20 },
  tab: (active: boolean): React.CSSProperties => ({
    padding: "7px 16px",
    borderRadius: 8,
    border: active ? "1px solid rgba(124,58,237,0.4)" : "1px solid rgba(255,255,255,0.07)",
    background: active ? "rgba(124,58,237,0.12)" : "rgba(255,255,255,0.04)",
    color: active ? "#c4b5fd" : "#64748b",
    fontWeight: active ? 700 : 500,
    fontSize: 12,
    cursor: "pointer",
    textDecoration: "none",
  }),

  card: {
    background: "rgba(15,23,42,0.8)",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.08)",
    marginBottom: 16,
    overflow: "hidden",
    backdropFilter: "blur(8px)",
  },
  cardHeader: {
    padding: "12px 20px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    fontWeight: 800,
    fontSize: 13,
    color: "#f1f5f9",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  cardBody: { padding: "20px" },

  input: {
    width: "100%",
    padding: "9px 12px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.05)",
    color: "#e2e8f0",
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box" as const,
  },
  label: { fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 5, display: "block", textTransform: "uppercase" as const, letterSpacing: "0.04em" },

  // Stats bar
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 },
  statBox: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 10,
    padding: "12px 14px",
  },
  statLabel: { fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 4 },
  statVal: { fontSize: 22, fontWeight: 900, color: "#f1f5f9" },
  statSub: { fontSize: 10, color: "#475569", marginTop: 2 },
};

/* ─── Page ───────────────────────────────────────────────────────────── */

export default function WebhooksPage() {
  // Current config
  const [config, setConfig] = useState<WebhookConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  const [configNotFound, setConfigNotFound] = useState(false);

  // Edit form
  const [editUrl, setEditUrl] = useState("");
  const [editSecret, setEditSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);

  // Delete
  const [deleting, setDeleting] = useState(false);

  // Test
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Logs
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsError, setLogsError] = useState<string | null>(null);

  // Stats
  const [stats, setStats] = useState<WebhookStats | null>(null);

  // Supported events
  const [events, setEvents] = useState<WebhookEvent[]>([]);

  // Active tab: "config" | "logs" | "events"
  const [activeTab, setActiveTab] = useState<"config" | "logs" | "events">("config");

  /* ── Load config ── */
  const loadConfig = useCallback(async () => {
    setConfigLoading(true);
    setConfigError(null);
    setConfigNotFound(false);
    try {
      const res = await fetch(apiUrl("/api/qcoreai/me/webhook"), { headers: bearerHeader() });
      if (res.status === 404) {
        setConfig(null);
        setConfigNotFound(true);
      } else if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setConfigError(d?.error || `HTTP ${res.status}`);
      } else {
        const d = await res.json();
        setConfig(d);
        setEditUrl(d.url || "");
      }
    } catch (e: any) {
      setConfigError(e?.message || "Failed to load webhook config");
    } finally {
      setConfigLoading(false);
    }
  }, []);

  /* ── Load logs ── */
  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    setLogsError(null);
    try {
      const res = await fetch(apiUrl("/api/qcoreai/me/webhook/log?limit=50"), { headers: bearerHeader() });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || `HTTP ${res.status}`);
      setLogs(Array.isArray(d.items) ? d.items : []);
    } catch (e: any) {
      setLogsError(e?.message || "Failed to load logs");
    } finally {
      setLogsLoading(false);
    }
  }, []);

  /* ── Load stats ── */
  const loadStats = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/qcoreai/me/webhook/stats"), { headers: bearerHeader() });
      const d = await res.json();
      if (res.ok) setStats(d);
    } catch {}
  }, []);

  /* ── Load events ── */
  const loadEvents = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/qcoreai/me/webhook/events"), { headers: bearerHeader() });
      const d = await res.json();
      if (res.ok && Array.isArray(d.events)) setEvents(d.events);
    } catch {}
  }, []);

  useEffect(() => {
    loadConfig();
    loadLogs();
    loadStats();
    loadEvents();
  }, [loadConfig, loadLogs, loadStats, loadEvents]);

  /* ── Save / Update webhook ── */
  const handleSave = async () => {
    if (!editUrl.trim() || saving) return;
    setSaving(true);
    setSaveError(null);
    setSaveOk(false);
    try {
      const body: Record<string, unknown> = { url: editUrl.trim() };
      if (editSecret.trim()) body.secret = editSecret.trim();

      const res = await fetch(apiUrl("/api/qcoreai/me/webhook"), {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...bearerHeader() },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || `HTTP ${res.status}`);

      setConfig(d);
      setEditSecret(""); // clear secret after save
      setSaveOk(true);
      setConfigNotFound(false);
      setTimeout(() => setSaveOk(false), 3000);
    } catch (e: any) {
      setSaveError(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  /* ── Delete webhook ── */
  const handleDelete = async () => {
    if (!confirm("Remove this webhook endpoint? QCoreAI will stop sending events to it.")) return;
    setDeleting(true);
    try {
      const res = await fetch(apiUrl("/api/qcoreai/me/webhook"), {
        method: "DELETE",
        headers: bearerHeader(),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || `HTTP ${res.status}`);
      }
      setConfig(null);
      setEditUrl("");
      setEditSecret("");
      setConfigNotFound(true);
    } catch (e: any) {
      alert(e?.message || "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  /* ── Test ── */
  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(apiUrl("/api/qcoreai/me/webhook/test"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...bearerHeader() },
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || `HTTP ${res.status}`);
      setTestResult({ ok: true, msg: `Test event sent to ${d.sentTo}` });
      await loadLogs();
    } catch (e: any) {
      setTestResult({ ok: false, msg: e?.message || "Test failed" });
    } finally {
      setTesting(false);
    }
  };

  /* ── Retry failed event ── */
  const handleRetry = async (log: WebhookLog) => {
    try {
      const res = await fetch(apiUrl("/api/qcoreai/me/webhook/retry"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...bearerHeader() },
        body: JSON.stringify({ event: log.event }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || `HTTP ${res.status}`);
      await loadLogs();
    } catch (e: any) {
      alert(e?.message || "Retry failed");
    }
  };

  const successRate = stats ? Math.round((stats.successRate || 0) * 100) : null;

  return (
    <div style={S.page}>
      <Wave1Nav />
      <div style={S.inner}>
        {/* ── Header ── */}
        <div style={S.headerCard}>
          <div style={S.headerRow}>
            <div style={S.iconBox}>&#128161;</div>
            <div>
              <h1 style={S.h1}>Webhooks</h1>
              <p style={S.subtitle}>Push QCoreAI events to your own endpoint in real time</p>
            </div>
            <Link href="/qcoreai/multi" style={S.backBtn}>
              &#8592; Back to QCoreAI
            </Link>
          </div>
          <p style={S.headerNote}>
            QCoreAI sends signed POST requests to your URL for events like{" "}
            <code style={{ background: "rgba(255,255,255,0.09)", padding: "1px 6px", borderRadius: 4, fontFamily: "monospace", fontSize: 11 }}>run.completed</code>,{" "}
            <code style={{ background: "rgba(255,255,255,0.09)", padding: "1px 6px", borderRadius: 4, fontFamily: "monospace", fontSize: 11 }}>agent.turn</code>, and more.
            Secure with an HMAC-SHA256 secret — verified via the{" "}
            <code style={{ background: "rgba(255,255,255,0.09)", padding: "1px 6px", borderRadius: 4, fontFamily: "monospace", fontSize: 11 }}>X-QCore-Signature</code> header.
          </p>
        </div>

        {/* ── Top nav ── */}
        <div style={S.tabBar}>
          <Link href="/qcoreai/api-keys" style={S.tab(false)}>
            &#128273; API Keys
          </Link>
          <span style={S.tab(true)}>&#128161; Webhooks</span>
          <Link href="/qcoreai/settings" style={S.tab(false)}>
            &#9881;&#65039; Settings
          </Link>
          <Link href="/qcoreai/audit-log" style={S.tab(false)}>
            &#128202; Audit Log
          </Link>
        </div>

        {/* ── Stats row ── */}
        {stats && stats.total > 0 && (
          <div style={S.statsGrid}>
            <div style={S.statBox}>
              <div style={S.statLabel}>Deliveries (30d)</div>
              <div style={S.statVal}>{stats.total.toLocaleString()}</div>
            </div>
            <div style={S.statBox}>
              <div style={S.statLabel}>Success rate</div>
              <div
                style={{
                  ...S.statVal,
                  color:
                    (successRate ?? 0) >= 95 ? "#34d399"
                    : (successRate ?? 0) >= 80 ? "#fbbf24"
                    : "#f87171",
                }}
              >
                {successRate}%
              </div>
            </div>
            <div style={S.statBox}>
              <div style={S.statLabel}>Avg latency</div>
              <div style={S.statVal}>
                <span style={{ fontSize: 18 }}>{stats.avgLatencyMs}</span>
                <span style={{ fontSize: 12, color: "#64748b", marginLeft: 3 }}>ms</span>
              </div>
            </div>
            <div style={S.statBox}>
              <div style={S.statLabel}>Errors (30d)</div>
              <div style={{ ...S.statVal, color: stats.errorCount > 0 ? "#f87171" : "#34d399" }}>
                {stats.errorCount}
              </div>
            </div>
          </div>
        )}

        {/* ── Inner tabs ── */}
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {(["config", "logs", "events"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              style={{
                padding: "6px 16px",
                borderRadius: 8,
                border:
                  activeTab === t
                    ? "1px solid rgba(124,58,237,0.35)"
                    : "1px solid rgba(255,255,255,0.06)",
                background:
                  activeTab === t ? "rgba(124,58,237,0.1)" : "rgba(255,255,255,0.03)",
                color: activeTab === t ? "#c4b5fd" : "#475569",
                fontSize: 12,
                fontWeight: activeTab === t ? 700 : 500,
                cursor: "pointer",
              }}
            >
              {t === "config" && "Endpoint"}
              {t === "logs" && `Delivery log${logs.length > 0 ? ` (${logs.length})` : ""}`}
              {t === "events" && "Event types"}
            </button>
          ))}
        </div>

        {/* ══ CONFIG TAB ═══════════════════════════════════════════════ */}
        {activeTab === "config" && (
          <>
            {configLoading && (
              <div style={{ ...S.card }}>
                <div style={{ padding: "32px 20px", textAlign: "center", color: "#475569" }}>
                  Loading webhook config...
                </div>
              </div>
            )}

            {configError && (
              <div style={{ ...S.card }}>
                <div style={{ padding: "16px 20px", color: "#f87171", fontSize: 12 }}>
                  {configError} — are you logged in?
                </div>
              </div>
            )}

            {!configLoading && !configError && (
              <div style={S.card}>
                <div style={S.cardHeader}>
                  <span
                    style={{
                      width: 8, height: 8, borderRadius: "50%",
                      background: config ? "#22c55e" : "#475569",
                      flexShrink: 0,
                    }}
                  />
                  {config ? "Webhook endpoint configured" : "No webhook configured"}
                </div>
                <div style={S.cardBody}>
                  {/* Current URL display */}
                  {config && (
                    <div
                      style={{
                        background: "rgba(34,197,94,0.06)",
                        border: "1px solid rgba(34,197,94,0.2)",
                        borderRadius: 8,
                        padding: "10px 14px",
                        marginBottom: 20,
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ fontSize: 10, color: "#4ade80", fontWeight: 700, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          Active endpoint
                        </div>
                        <code style={{ fontSize: 12, color: "#bbf7d0", wordBreak: "break-all", fontFamily: "monospace" }}>
                          {config.url}
                        </code>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: 10, color: "#64748b" }}>Secret</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: config.hasSecret ? "#34d399" : "#475569" }}>
                          {config.hasSecret ? "Configured" : "None"}
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: 10, color: "#64748b" }}>Updated</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>
                          {fmtRelative(config.updatedAt)}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Edit form */}
                  <div style={{ display: "grid", gap: 14 }}>
                    <div>
                      <label style={S.label}>Endpoint URL *</label>
                      <input
                        value={editUrl}
                        onChange={(e) => setEditUrl(e.target.value)}
                        placeholder="https://your-app.com/webhooks/qcoreai"
                        style={S.input}
                      />
                      <div style={{ fontSize: 11, color: "#475569", marginTop: 5 }}>
                        Must be HTTPS (HTTP allowed in dev). We block loopback/private IPs in production.
                      </div>
                    </div>

                    <div>
                      <label style={S.label}>
                        Signing secret (optional{config?.hasSecret ? " — leave blank to keep current" : ""})
                      </label>
                      <input
                        type="password"
                        value={editSecret}
                        onChange={(e) => setEditSecret(e.target.value)}
                        placeholder={config?.hasSecret ? "•••••••••••••••• (currently set)" : "Enter a random secret string"}
                        style={S.input}
                        autoComplete="new-password"
                      />
                      <div style={{ fontSize: 11, color: "#475569", marginTop: 5 }}>
                        QCoreAI will compute{" "}
                        <code style={{ background: "rgba(255,255,255,0.07)", padding: "1px 5px", borderRadius: 4, fontFamily: "monospace" }}>
                          HMAC-SHA256(secret, body)
                        </code>{" "}
                        and send it in the{" "}
                        <code style={{ background: "rgba(255,255,255,0.07)", padding: "1px 5px", borderRadius: 4, fontFamily: "monospace" }}>
                          X-QCore-Signature
                        </code>{" "}
                        header.
                      </div>
                    </div>

                    {saveError && (
                      <div style={{ fontSize: 12, color: "#f87171" }}>{saveError}</div>
                    )}
                    {saveOk && (
                      <div style={{ fontSize: 12, color: "#34d399" }}>
                        &#10003; Webhook saved successfully.
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        onClick={handleSave}
                        disabled={!editUrl.trim() || saving}
                        style={{
                          padding: "9px 22px",
                          borderRadius: 8,
                          background:
                            editUrl.trim() && !saving
                              ? "linear-gradient(135deg, #7c3aed, #4f46e5)"
                              : "rgba(255,255,255,0.07)",
                          border: "none",
                          color: editUrl.trim() && !saving ? "#fff" : "#475569",
                          fontWeight: 700,
                          fontSize: 13,
                          cursor: editUrl.trim() && !saving ? "pointer" : "default",
                          boxShadow: editUrl.trim() && !saving ? "0 0 12px rgba(124,58,237,0.3)" : "none",
                        }}
                      >
                        {saving ? "Saving..." : config ? "Update endpoint" : "Save endpoint"}
                      </button>

                      {config && (
                        <>
                          <button
                            onClick={handleTest}
                            disabled={testing}
                            style={{
                              padding: "9px 22px",
                              borderRadius: 8,
                              background: "rgba(6,182,212,0.1)",
                              border: "1px solid rgba(6,182,212,0.3)",
                              color: "#67e8f9",
                              fontWeight: 700,
                              fontSize: 13,
                              cursor: testing ? "default" : "pointer",
                            }}
                          >
                            {testing ? "Sending..." : "Send test event"}
                          </button>

                          <button
                            onClick={handleDelete}
                            disabled={deleting}
                            style={{
                              padding: "9px 22px",
                              borderRadius: 8,
                              background: "rgba(239,68,68,0.07)",
                              border: "1px solid rgba(239,68,68,0.2)",
                              color: "#f87171",
                              fontWeight: 700,
                              fontSize: 13,
                              cursor: deleting ? "default" : "pointer",
                            }}
                          >
                            {deleting ? "Removing..." : "Remove webhook"}
                          </button>
                        </>
                      )}
                    </div>

                    {/* Test result */}
                    {testResult && (
                      <div
                        style={{
                          padding: "10px 14px",
                          borderRadius: 8,
                          background: testResult.ok ? "rgba(34,197,94,0.07)" : "rgba(239,68,68,0.07)",
                          border: `1px solid ${testResult.ok ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
                          fontSize: 12,
                          color: testResult.ok ? "#4ade80" : "#f87171",
                        }}
                      >
                        {testResult.ok ? "&#10003;" : "&#10007;"} {testResult.msg}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Help box */}
            <div
              style={{
                background: "rgba(124,58,237,0.05)",
                border: "1px solid rgba(124,58,237,0.15)",
                borderRadius: 10,
                padding: "14px 18px",
                fontSize: 12,
                color: "#a78bfa",
                lineHeight: 1.7,
              }}
            >
              <strong>Payload format:</strong> JSON POST with{" "}
              <code style={{ background: "rgba(124,58,237,0.12)", padding: "1px 5px", borderRadius: 4, fontFamily: "monospace" }}>
                {"{ event, runId, sessionId, status, strategy, userInput, finalContent, totalCostUsd, finishedAt }"}
              </code>
              . Respond with HTTP 2xx within 10s or the delivery is marked failed.
              You can retry failed deliveries from the Delivery log tab.
            </div>
          </>
        )}

        {/* ══ LOGS TAB ═════════════════════════════════════════════════ */}
        {activeTab === "logs" && (
          <div style={S.card}>
            <div style={S.cardHeader}>
              <span>Delivery log</span>
              <span style={{ fontSize: 11, color: "#475569", fontWeight: 500 }}>(last 50)</span>
              <button
                onClick={loadLogs}
                style={{
                  marginLeft: "auto",
                  background: "none",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 6,
                  color: "#475569",
                  fontSize: 11,
                  padding: "3px 10px",
                  cursor: "pointer",
                }}
              >
                Refresh
              </button>
            </div>

            {logsLoading && (
              <div style={{ padding: "32px 20px", textAlign: "center", color: "#475569" }}>
                Loading delivery log...
              </div>
            )}

            {logsError && (
              <div style={{ padding: "16px 20px", fontSize: 12, color: "#f87171" }}>
                {logsError}
              </div>
            )}

            {!logsLoading && !logsError && logs.length === 0 && (
              <div style={{ padding: "36px 20px", textAlign: "center", color: "#475569", fontSize: 13 }}>
                No deliveries recorded yet.{" "}
                {config && (
                  <button
                    onClick={() => { setActiveTab("config"); setTimeout(handleTest, 100); }}
                    style={{ background: "none", border: "none", color: "#7c3aed", cursor: "pointer", fontSize: 13, textDecoration: "underline" }}
                  >
                    Send a test event
                  </button>
                )}
              </div>
            )}

            {!logsLoading && logs.map((log, i) => {
              const ok = !log.error && log.statusCode !== null && log.statusCode >= 200 && log.statusCode < 300;
              return (
                <div
                  key={log.id}
                  style={{
                    padding: "12px 20px",
                    borderBottom: i < logs.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  {/* Status dot */}
                  <div
                    style={{
                      marginTop: 3,
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: ok ? "#22c55e" : "#ef4444",
                      flexShrink: 0,
                    }}
                  />

                  {/* Event + URL */}
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span
                        style={{
                          background: "rgba(255,255,255,0.07)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 5,
                          padding: "2px 8px",
                          fontSize: 11,
                          fontFamily: "monospace",
                          color: "#94a3b8",
                        }}
                      >
                        {EVENT_ICONS[log.event] || "•"} {log.event}
                      </span>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 5,
                          background: statusBg(log.statusCode, log.error),
                          border: `1px solid ${statusColor(log.statusCode, log.error)}30`,
                          fontSize: 11,
                          fontWeight: 700,
                          color: statusColor(log.statusCode, log.error),
                        }}
                      >
                        {log.statusCode ?? "ERR"}
                      </span>
                      {log.durationMs !== null && (
                        <span style={{ fontSize: 11, color: "#475569" }}>{log.durationMs}ms</span>
                      )}
                    </div>
                    {log.error && (
                      <div style={{ fontSize: 11, color: "#f87171", marginTop: 4 }}>{log.error}</div>
                    )}
                    <div style={{ fontSize: 11, color: "#334155", marginTop: 3, wordBreak: "break-all" }}>
                      {log.url}
                    </div>
                  </div>

                  {/* Time + retry */}
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 11, color: "#475569" }}>{fmtRelative(log.createdAt)}</div>
                    <div style={{ fontSize: 10, color: "#334155" }}>{fmtTime(log.createdAt)}</div>
                    {!ok && (
                      <button
                        onClick={() => handleRetry(log)}
                        style={{
                          marginTop: 4,
                          padding: "3px 9px",
                          borderRadius: 5,
                          background: "rgba(124,58,237,0.1)",
                          border: "1px solid rgba(124,58,237,0.25)",
                          color: "#a78bfa",
                          fontSize: 10,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Retry
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ══ EVENTS TAB ═══════════════════════════════════════════════ */}
        {activeTab === "events" && (
          <div style={S.card}>
            <div style={S.cardHeader}>
              Supported event types
              <span style={{ fontSize: 11, color: "#475569", fontWeight: 500 }}>
                ({events.length} events)
              </span>
            </div>

            {events.length === 0 && (
              <div style={{ padding: "32px 20px", textAlign: "center", color: "#475569" }}>
                Loading event types...
              </div>
            )}

            {events.map((evt, i) => (
              <div
                key={evt.name}
                style={{
                  padding: "14px 20px",
                  borderBottom: i < events.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                  display: "flex",
                  gap: 14,
                  alignItems: "flex-start",
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: "rgba(124,58,237,0.1)",
                    border: "1px solid rgba(124,58,237,0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 16,
                    color: "#a78bfa",
                    fontFamily: "monospace",
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {EVENT_ICONS[evt.name] || "·"}
                </div>
                <div style={{ flex: 1 }}>
                  <code
                    style={{
                      fontSize: 13,
                      fontFamily: "monospace",
                      color: "#c4b5fd",
                      fontWeight: 700,
                    }}
                  >
                    {evt.name}
                  </code>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 4, lineHeight: 1.5 }}>
                    {evt.description}
                  </div>
                </div>
              </div>
            ))}

            <div
              style={{
                padding: "14px 20px",
                borderTop: "1px solid rgba(255,255,255,0.04)",
                fontSize: 12,
                color: "#475569",
              }}
            >
              All events are delivered as POST requests with JSON body. Set up your endpoint in the{" "}
              <button
                onClick={() => setActiveTab("config")}
                style={{ background: "none", border: "none", color: "#7c3aed", cursor: "pointer", fontSize: 12, textDecoration: "underline" }}
              >
                Endpoint tab
              </button>
              .
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
