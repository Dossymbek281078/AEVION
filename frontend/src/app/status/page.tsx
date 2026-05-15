"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/apiBase";

type ServiceProbe = {
  name: string;
  ok: boolean;
  status: number;
  durationMs: number;
  summary: Record<string, unknown> | null;
};

type HubResponse = {
  status: "ok" | "degraded" | "down";
  healthy: number;
  total: number;
  services: Record<string, ServiceProbe>;
  timestamp: string;
};

type HistoryPoint = {
  t: number;
  ok: boolean;
  healthy: number;
  total: number;
  perService?: Record<string, boolean>;
};
const HISTORY_KEY = "aevion_status_history_v2";
const HISTORY_MAX = 60; // last 60 polls

type RegistryStats = {
  total: number;
  byStatus: Record<string, number>;
  byKind: Record<string, number>;
  byTag: { tag: string; count: number }[];
  generatedAt: string;
};

type CatalogItem = {
  id: string;
  name: string;
  status: string;
  frontend: string;
  kind: string;
};

type CatalogResponse = {
  total: number;
  items: CatalogItem[];
};

type IncidentUpdate = {
  t: string;
  status: "investigating" | "identified" | "monitoring" | "resolved";
  message: string;
};

type Incident = {
  id: string;
  title: string;
  severity: "minor" | "major" | "critical";
  affected: string[];
  startedAt: string;
  resolvedAt: string | null;
  updates: IncidentUpdate[];
};

type IncidentsResponse = {
  total: number;
  open: number;
  items: Incident[];
  generatedAt: string;
};

const SEVERITY_COLOR: Record<Incident["severity"], string> = {
  minor: "#f59e0b",
  major: "#f97316",
  critical: "#ef4444",
};

const UPDATE_COLOR: Record<IncidentUpdate["status"], string> = {
  investigating: "#f59e0b",
  identified: "#3b82f6",
  monitoring: "#8b5cf6",
  resolved: "#10b981",
};

function relTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return iso;
  const diffMs = Date.now() - t;
  const abs = Math.abs(diffMs);
  const mins = Math.round(abs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

type ProcessMetrics = {
  generatedAt: string;
  process: {
    node: string;
    pid: number;
    uptimeSec: number;
    memory: {
      heapUsedBytes: number;
      heapTotalBytes: number;
      rssBytes: number;
      externalBytes: number;
    };
    sentryEnabled: boolean;
  };
  summary: Record<string, number>;
};

const AUTOREFRESH_KEY = "aevion_status_autorefresh_v1";

function fmtBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2)} ${units[i]}`;
}

function fmtUptime(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "0s";
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h || d) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(" ");
}

const STATUS_COLORS: Record<string, string> = {
  launched: "#10b981",
  mvp: "#10b981",
  working: "#10b981",
  in_progress: "#f59e0b",
  research: "#8b5cf6",
  planning: "#3b82f6",
  idea: "#94a3b8",
};

const STATUS_ORDER = ["launched", "mvp", "in_progress", "research", "planning", "idea"];

function loadHistory(): HistoryPoint[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(-HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

function saveHistory(h: HistoryPoint[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(-HISTORY_MAX)));
  } catch {
    /* ignore */
  }
}

const SERVICE_LABELS: Record<string, string> = {
  pipeline: "IP Pipeline",
  "qsign-v2": "QSign v2",
  "qsign-legacy": "QSign v1 (legacy)",
  "quantum-shield": "Quantum Shield",
  qright: "QRight",
  planet: "Planet Compliance",
  bureau: "IP Bureau",
  auth: "Auth",
  qcontract: "QContract",
  qpaynet: "QPayNet",
  healthai: "HealthAI",
  "smeta-trainer": "Smeta Trainer",
  qbuild: "QBuild",
};

const SERVICE_LINKS: Record<string, string> = {
  pipeline: "/qright",
  "qsign-v2": "/qsign",
  "qsign-legacy": "/qsign",
  "quantum-shield": "/quantum-shield",
  qright: "/qright",
  planet: "/planet",
  bureau: "/bureau",
  auth: "/account",
  qcontract: "/qcontract",
  qpaynet: "/qpaynet",
  healthai: "/healthai",
  "smeta-trainer": "/smeta-trainer",
  qbuild: "/build",
};

export default function StatusPage() {
  const [data, setData] = useState<HubResponse | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<number | null>(null);
  const [version, setVersion] = useState<{
    node?: string;
    env?: string;
    uptimeSec?: number;
    release?: string | null;
  } | null>(null);
  const [stats, setStats] = useState<RegistryStats | null>(null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [metrics, setMetrics] = useState<ProcessMetrics | null>(null);
  const [incidents, setIncidents] = useState<IncidentsResponse | null>(null);
  const [subEmail, setSubEmail] = useState<string>("");
  const [subState, setSubState] = useState<{
    status: "idle" | "submitting" | "ok" | "error";
    message: string;
  }>({ status: "idle", message: "" });
  const [autoRefresh, setAutoRefresh] = useState<boolean>(() => {
    // Default ON — match the previous always-on behaviour. Persists across
    // visits so an oncall who turned it off doesn't get surprised next time.
    if (typeof window === "undefined") return true;
    try {
      const raw = localStorage.getItem(AUTOREFRESH_KEY);
      return raw === null ? true : raw === "1";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(AUTOREFRESH_KEY, autoRefresh ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [autoRefresh]);

  useEffect(() => {
    setHistory(loadHistory());
    let cancelled = false;
    let timer: NodeJS.Timeout | null = null;

    const tick = async () => {
      try {
        const res = await fetch(apiUrl("/api/aevion/health"));
        if (!res.ok) throw new Error("HTTP " + res.status);
        const json = (await res.json()) as HubResponse;
        if (cancelled) return;
        setData(json);
        setError(null);
        setLastFetched(Date.now());
        const perService: Record<string, boolean> = {};
        for (const [k, v] of Object.entries(json.services)) perService[k] = v.ok;
        const point: HistoryPoint = {
          t: Date.now(),
          ok: json.status === "ok",
          healthy: json.healthy,
          total: json.total,
          perService,
        };
        const next = [...loadHistory(), point].slice(-HISTORY_MAX);
        setHistory(next);
        saveHistory(next);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    };

    const tickStats = async () => {
      try {
        const [statsRes, catRes] = await Promise.all([
          fetch(apiUrl("/api/aevion/registry-stats")),
          fetch(apiUrl("/api/aevion/catalog?fields=id,name,status,frontend,kind")),
        ]);
        if (statsRes.ok) {
          const j = (await statsRes.json()) as RegistryStats;
          if (!cancelled) setStats(j);
        }
        if (catRes.ok) {
          const j = (await catRes.json()) as CatalogResponse;
          if (!cancelled) setCatalog(j.items || []);
        }
      } catch {
        /* ignore */
      }
    };

    const tickVersion = async () => {
      try {
        const res = await fetch(apiUrl("/api/aevion/version"));
        if (!res.ok) return;
        const j = await res.json();
        if (!cancelled) setVersion(j);
      } catch {
        /* ignore */
      }
    };

    const tickMetrics = async () => {
      try {
        const res = await fetch(apiUrl("/api/metrics/json"));
        if (!res.ok) return; // 401 if METRICS_TOKEN set — silently degrade
        const j = (await res.json()) as ProcessMetrics;
        if (!cancelled) setMetrics(j);
      } catch {
        /* ignore */
      }
    };

    const tickIncidents = async () => {
      try {
        const res = await fetch(apiUrl("/api/status/incidents?limit=10"));
        if (!res.ok) return; // silently degrade — incident surface is best-effort
        const j = (await res.json()) as IncidentsResponse;
        if (!cancelled) setIncidents(j);
      } catch {
        /* ignore */
      }
    };

    // First fetch always runs so the page isn't blank when auto-refresh is off.
    tick();
    tickVersion();
    tickStats();
    tickMetrics();
    tickIncidents();

    if (autoRefresh) {
      timer = setInterval(tick, 30_000);
      const statsTimer = setInterval(tickStats, 5 * 60_000);
      const metricsTimer = setInterval(tickMetrics, 30_000);
      const incidentsTimer = setInterval(tickIncidents, 60_000);
      return () => {
        cancelled = true;
        if (timer) clearInterval(timer);
        clearInterval(statsTimer);
        clearInterval(metricsTimer);
        clearInterval(incidentsTimer);
      };
    }

    return () => {
      cancelled = true;
    };
  }, [autoRefresh]);

  const onSubscribe = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const email = subEmail.trim().toLowerCase();
    if (!email) return;
    setSubState({ status: "submitting", message: "" });
    try {
      const res = await fetch(apiUrl("/api/status/subscribe"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; error?: string };
      if (!res.ok || j.ok === false) {
        const msg =
          j.error === "invalid_email"
            ? "That doesn't look like a valid email."
            : j.error || `Subscribe failed (HTTP ${res.status})`;
        setSubState({ status: "error", message: msg });
        return;
      }
      setSubState({
        status: "ok",
        message: j.message || "Subscribed. You'll get email digests on major incidents.",
      });
      setSubEmail("");
    } catch (err) {
      setSubState({
        status: "error",
        message: err instanceof Error ? err.message : "Network error.",
      });
    }
  };

  const overallColor =
    data?.status === "ok"
      ? "#10b981"
      : data?.status === "degraded"
        ? "#f59e0b"
        : "#ef4444";
  const overallLabel =
    data?.status === "ok"
      ? "All systems operational"
      : data?.status === "degraded"
        ? "Partial service outage"
        : data?.status === "down"
          ? "Major outage"
          : "Loading…";

  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", color: "#0f172a" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "60px 20px" }}>
        <div style={{ marginBottom: 28 }}>
          <Link href="/" style={{ fontSize: 12, color: "#64748b", textDecoration: "none" }}>
            ← AEVION
          </Link>
          <h1 style={{ fontSize: 36, fontWeight: 900, margin: "8px 0", letterSpacing: "-0.02em" }}>
            AEVION Status
          </h1>
          <p style={{ fontSize: 14, color: "#64748b", margin: 0 }}>
            Live health of every product on the planet — polled every 30 seconds when auto-refresh
            is on. Last 60 polls retained locally. Catalog refreshed every 5 minutes.
          </p>
        </div>

        {/* Catalog overview */}
        {stats && (
          <div
            style={{
              padding: "18px 22px",
              borderRadius: 12,
              background: "#fff",
              border: "1px solid rgba(15,23,42,0.08)",
              marginBottom: 18,
              display: "flex",
              alignItems: "center",
              gap: 18,
              flexWrap: "wrap",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Registry
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, color: "#0f172a" }}>{stats.total}</div>
            <div style={{ fontSize: 11, color: "#64748b" }}>modules</div>
            <div style={{ flex: 1 }} />
            {STATUS_ORDER.filter((s) => stats.byStatus[s]).map((s) => (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: STATUS_COLORS[s] || "#94a3b8",
                  }}
                  aria-hidden
                />
                <span style={{ fontSize: 11, color: "#475569", fontFamily: "monospace" }}>
                  {s} {stats.byStatus[s]}
                </span>
              </div>
            ))}
            <Link
              href="/fintech/catalog"
              style={{ fontSize: 11, color: "#0d9488", textDecoration: "none", marginLeft: 8 }}
            >
              Browse →
            </Link>
          </div>
        )}

        {/* Overall banner */}
        <div
          style={{
            padding: "26px 28px",
            borderRadius: 16,
            background: "#fff",
            border: `1px solid ${overallColor}40`,
            marginBottom: 22,
            display: "flex",
            alignItems: "center",
            gap: 18,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: 999,
              background: overallColor,
              boxShadow: `0 0 0 5px ${overallColor}25`,
            }}
            aria-hidden
          />
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: overallColor }}>
              {overallLabel}
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
              {data
                ? `${data.healthy}/${data.total} services responding`
                : error
                  ? `Probe failed: ${error}`
                  : "Connecting to /api/aevion/health…"}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace" }}>
              {lastFetched
                ? new Date(lastFetched).toLocaleTimeString()
                : ""}
            </div>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11,
                color: autoRefresh ? "#0d9488" : "#94a3b8",
                cursor: "pointer",
                userSelect: "none",
                padding: "4px 10px",
                borderRadius: 999,
                background: autoRefresh ? "#ecfdf5" : "#f1f5f9",
                border: `1px solid ${autoRefresh ? "#10b98140" : "#cbd5e1"}`,
                fontWeight: 700,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
              title="Toggle 30s background polling. First fetch always runs."
            >
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                style={{ margin: 0, cursor: "pointer" }}
              />
              Auto-refresh
            </label>
          </div>
        </div>

        {/* Process metrics (from /api/metrics/json) */}
        {metrics && (
          <div
            style={{
              padding: "18px 22px",
              borderRadius: 12,
              background: "#fff",
              border: "1px solid rgba(15,23,42,0.08)",
              marginBottom: 22,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: "#64748b",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                Backend process
              </div>
              <Link
                href="/api/metrics/json"
                style={{ fontSize: 10, color: "#0d9488", textDecoration: "none", fontFamily: "monospace" }}
              >
                /api/metrics/json →
              </Link>
            </div>
            <div
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
              }}
            >
              {(() => {
                const heapPct =
                  metrics.process.memory.heapTotalBytes > 0
                    ? Math.round(
                        (metrics.process.memory.heapUsedBytes / metrics.process.memory.heapTotalBytes) *
                          1000,
                      ) / 10
                    : 0;
                const heapColor = heapPct >= 90 ? "#ef4444" : heapPct >= 70 ? "#f59e0b" : "#10b981";
                const tiles: { label: string; value: string; sub?: string; color?: string }[] = [
                  { label: "Uptime", value: fmtUptime(metrics.process.uptimeSec), sub: `${metrics.process.uptimeSec}s` },
                  {
                    label: "Heap used",
                    value: fmtBytes(metrics.process.memory.heapUsedBytes),
                    sub: `${heapPct}% of ${fmtBytes(metrics.process.memory.heapTotalBytes)}`,
                    color: heapColor,
                  },
                  { label: "RSS", value: fmtBytes(metrics.process.memory.rssBytes) },
                  { label: "External", value: fmtBytes(metrics.process.memory.externalBytes) },
                  { label: "Node", value: metrics.process.node },
                  {
                    label: "Sentry",
                    value: metrics.process.sentryEnabled ? "ON" : "OFF",
                    color: metrics.process.sentryEnabled ? "#10b981" : "#94a3b8",
                  },
                  {
                    label: "Accounts",
                    value: String(metrics.summary["aevion_accounts_total"] ?? 0),
                  },
                  {
                    label: "Transfers",
                    value: String(metrics.summary["aevion_transfers_total"] ?? 0),
                  },
                ];
                return tiles.map((t) => (
                  <div
                    key={t.label}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 8,
                      background: "#f8fafc",
                      border: "1px solid rgba(15,23,42,0.06)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: "#64748b",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                      }}
                    >
                      {t.label}
                    </div>
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 900,
                        color: t.color || "#0f172a",
                        marginTop: 2,
                        fontFamily: "monospace",
                      }}
                    >
                      {t.value}
                    </div>
                    {t.sub && (
                      <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2, fontFamily: "monospace" }}>
                        {t.sub}
                      </div>
                    )}
                  </div>
                ));
              })()}
            </div>
          </div>
        )}

        {/* History sparkline */}
        {history.length > 1 && (
          <div
            style={{
              padding: "16px 22px",
              borderRadius: 12,
              background: "#fff",
              border: "1px solid rgba(15,23,42,0.08)",
              marginBottom: 22,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", marginBottom: 8, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Last {history.length} probes
            </div>
            <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 36 }}>
              {history.map((p) => {
                const ratio = p.total ? p.healthy / p.total : 0;
                const c = ratio === 1 ? "#10b981" : ratio > 0 ? "#f59e0b" : "#ef4444";
                return (
                  <div
                    key={p.t}
                    title={`${new Date(p.t).toLocaleTimeString()} — ${p.healthy}/${p.total}`}
                    style={{
                      flex: 1,
                      height: `${Math.max(8, ratio * 36)}px`,
                      background: c,
                      borderRadius: 2,
                      minWidth: 3,
                    }}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Per-service grid */}
        {data && (
          <div
            style={{
              display: "grid",
              gap: 10,
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              marginBottom: 22,
            }}
          >
            {Object.entries(data.services).map(([key, svc]) => {
              const label = SERVICE_LABELS[key] || key;
              const c = svc.ok ? "#10b981" : "#ef4444";
              const link = SERVICE_LINKS[key];
              const summary = svc.summary || {};
              const probesWithService = history.filter((p) => p.perService && key in p.perService);
              const okProbes = probesWithService.filter((p) => p.perService![key]).length;
              const uptimePct = probesWithService.length ? Math.round((okProbes / probesWithService.length) * 1000) / 10 : null;
              return (
                <div
                  key={key}
                  style={{
                    padding: "14px 16px",
                    borderRadius: 12,
                    background: "#fff",
                    border: `1px solid ${c}30`,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 999,
                        background: c,
                        boxShadow: `0 0 0 4px ${c}20`,
                      }}
                      aria-hidden
                    />
                    <div style={{ fontWeight: 800, fontSize: 14, flex: 1 }}>{label}</div>
                    {link && (
                      <Link href={link} style={{ fontSize: 10, color: "#64748b", textDecoration: "none" }}>
                        Open →
                      </Link>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b", display: "flex", justifyContent: "space-between" }}>
                    <span>HTTP {svc.status || "—"}</span>
                    <span>{svc.durationMs}ms</span>
                    {uptimePct !== null && (
                      <span
                        title={`${okProbes}/${probesWithService.length} probes ok`}
                        style={{ color: uptimePct >= 99 ? "#10b981" : uptimePct >= 95 ? "#f59e0b" : "#ef4444", fontWeight: 700 }}
                      >
                        {uptimePct}% up
                      </span>
                    )}
                  </div>
                  {svc.ok && Object.keys(summary).length > 0 && (
                    <div
                      style={{
                        marginTop: 8,
                        padding: "6px 8px",
                        borderRadius: 6,
                        background: "#f8fafc",
                        fontSize: 10,
                        fontFamily: "monospace",
                        color: "#475569",
                        wordBreak: "break-all",
                        lineHeight: 1.4,
                      }}
                    >
                      {Object.entries(summary)
                        .slice(0, 4)
                        .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : v}`)
                        .join(" · ")}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Incident history */}
        {incidents && (
          <div
            style={{
              padding: "18px 22px",
              borderRadius: 12,
              background: "#fff",
              border: "1px solid rgba(15,23,42,0.08)",
              marginBottom: 22,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 12,
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: "#64748b",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                Incident history
              </div>
              <div style={{ flex: 1 }} />
              <span
                style={{
                  fontSize: 11,
                  fontFamily: "monospace",
                  color: incidents.open > 0 ? "#ef4444" : "#10b981",
                  fontWeight: 700,
                }}
              >
                {incidents.open > 0
                  ? `${incidents.open} open · ${incidents.total} total`
                  : `0 open · ${incidents.total} total`}
              </span>
            </div>

            {incidents.items.length === 0 ? (
              <div style={{ fontSize: 13, color: "#64748b", fontStyle: "italic" }}>
                No incidents reported. All clear.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {incidents.items.map((inc) => {
                  const sev = SEVERITY_COLOR[inc.severity];
                  const isOpen = inc.resolvedAt === null;
                  return (
                    <div
                      key={inc.id}
                      style={{
                        padding: "12px 14px",
                        borderRadius: 10,
                        background: "#f8fafc",
                        border: `1px solid ${sev}30`,
                        borderLeft: `4px solid ${sev}`,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          marginBottom: 6,
                          flexWrap: "wrap",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 800,
                            color: "#fff",
                            background: sev,
                            padding: "2px 7px",
                            borderRadius: 4,
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                          }}
                        >
                          {inc.severity}
                        </span>
                        <div style={{ fontWeight: 700, fontSize: 13, flex: 1, minWidth: 200 }}>
                          {inc.title}
                        </div>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: isOpen ? "#ef4444" : "#10b981",
                            background: isOpen ? "#fee2e2" : "#dcfce7",
                            padding: "2px 8px",
                            borderRadius: 999,
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                          }}
                        >
                          {isOpen ? "Open" : "Resolved"}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "#64748b",
                          marginBottom: 8,
                          display: "flex",
                          gap: 12,
                          flexWrap: "wrap",
                        }}
                      >
                        <span>Started {relTime(inc.startedAt)}</span>
                        {inc.resolvedAt && <span>Resolved {relTime(inc.resolvedAt)}</span>}
                        {inc.affected.length > 0 && (
                          <span>
                            Affected:{" "}
                            <span style={{ fontFamily: "monospace", color: "#475569" }}>
                              {inc.affected.map((k) => SERVICE_LABELS[k] || k).join(", ")}
                            </span>
                          </span>
                        )}
                      </div>
                      {inc.updates.length > 0 && (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                            paddingLeft: 10,
                            borderLeft: "1px solid rgba(15,23,42,0.08)",
                          }}
                        >
                          {inc.updates.map((u, i) => (
                            <div key={`${inc.id}-u-${i}`} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                              <div
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: 999,
                                  background: UPDATE_COLOR[u.status],
                                  marginTop: 5,
                                  flexShrink: 0,
                                }}
                                aria-hidden
                              />
                              <div style={{ flex: 1 }}>
                                <div
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 800,
                                    color: UPDATE_COLOR[u.status],
                                    letterSpacing: "0.06em",
                                    textTransform: "uppercase",
                                    marginBottom: 2,
                                  }}
                                >
                                  {u.status} · {relTime(u.t)}
                                </div>
                                <div style={{ fontSize: 12, color: "#334155", lineHeight: 1.45 }}>
                                  {u.message}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Subscribe to status updates */}
        <div
          style={{
            padding: "18px 22px",
            borderRadius: 12,
            background: "#fff",
            border: "1px solid rgba(15,23,42,0.08)",
            marginBottom: 22,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: "#64748b",
              marginBottom: 4,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            Subscribe to status updates
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
            Get an email when AEVION opens a major incident, posts an update, or marks one resolved.
            No marketing — just incident digests.
          </div>
          <form
            onSubmit={onSubscribe}
            style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "stretch" }}
          >
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="you@company.com"
              value={subEmail}
              onChange={(e) => {
                setSubEmail(e.target.value);
                if (subState.status !== "idle") setSubState({ status: "idle", message: "" });
              }}
              style={{
                flex: "1 1 240px",
                minWidth: 220,
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid rgba(15,23,42,0.12)",
                background: "#f8fafc",
                fontSize: 13,
                color: "#0f172a",
                outline: "none",
              }}
              disabled={subState.status === "submitting"}
            />
            <button
              type="submit"
              disabled={subState.status === "submitting" || !subEmail.trim()}
              style={{
                padding: "10px 18px",
                borderRadius: 8,
                border: "none",
                background: subState.status === "submitting" ? "#94a3b8" : "#0d9488",
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
                cursor: subState.status === "submitting" || !subEmail.trim() ? "not-allowed" : "pointer",
                letterSpacing: "0.02em",
              }}
            >
              {subState.status === "submitting" ? "Subscribing…" : "Subscribe"}
            </button>
          </form>
          {subState.message && (
            <div
              role={subState.status === "error" ? "alert" : "status"}
              style={{
                marginTop: 10,
                fontSize: 12,
                fontWeight: 600,
                color: subState.status === "ok" ? "#10b981" : "#ef4444",
              }}
            >
              {subState.message}
            </div>
          )}
        </div>

        {/* All modules in registry */}
        {catalog.length > 0 && (
          <div
            style={{
              padding: "18px 22px",
              borderRadius: 12,
              background: "#fff",
              border: "1px solid rgba(15,23,42,0.08)",
              marginBottom: 22,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", marginBottom: 12, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              All {catalog.length} modules in registry
            </div>
            <div
              style={{
                display: "grid",
                gap: 8,
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              }}
            >
              {STATUS_ORDER.flatMap((statusKey) =>
                catalog
                  .filter((m) => m.status === statusKey)
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((m) => (
                    <a
                      key={m.id}
                      href={m.frontend}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 10px",
                        borderRadius: 8,
                        background: "#f8fafc",
                        border: "1px solid rgba(15,23,42,0.06)",
                        textDecoration: "none",
                        color: "#0f172a",
                      }}
                    >
                      <div
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 999,
                          background: STATUS_COLORS[m.status] || "#94a3b8",
                          flexShrink: 0,
                        }}
                        aria-hidden
                      />
                      <span style={{ fontSize: 12, fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {m.name.split("—")[0].trim()}
                      </span>
                      <span style={{ fontSize: 9, color: "#94a3b8", fontFamily: "monospace", textTransform: "uppercase" }}>
                        {m.status}
                      </span>
                    </a>
                  )),
              )}
            </div>
          </div>
        )}

        {/* Build info */}
        {version && (
          <div
            style={{
              padding: "14px 18px",
              borderRadius: 12,
              background: "#fff",
              border: "1px solid rgba(15,23,42,0.08)",
              fontSize: 11,
              color: "#64748b",
              fontFamily: "monospace",
              display: "flex",
              gap: 18,
              flexWrap: "wrap",
            }}
          >
            <span>node {version.node}</span>
            <span>env {version.env}</span>
            <span>uptime {Math.round((version.uptimeSec || 0) / 60)}m</span>
            {version.release && <span>release {version.release}</span>}
          </div>
        )}

        <div style={{ marginTop: 22, fontSize: 11, color: "#94a3b8" }}>
          Source: <code>GET /api/aevion/health</code> ·{" "}
          <code>GET /api/status/incidents</code> · Cache 10s ·{" "}
          <Link href="/api/aevion/openapi.json" style={{ color: "#0d9488" }}>
            OpenAPI index
          </Link>
        </div>
      </div>
    </main>
  );
}
