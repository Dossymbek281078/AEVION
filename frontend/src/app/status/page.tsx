"use client";

import { useEffect, useState } from "react";
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

type HistoryPoint = { t: number; ok: boolean; healthy: number; total: number };
const HISTORY_KEY = "aevion_status_history_v1";
const HISTORY_MAX = 60; // last 60 polls

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
        const point: HistoryPoint = {
          t: Date.now(),
          ok: json.status === "ok",
          healthy: json.healthy,
          total: json.total,
        };
        const next = [...loadHistory(), point].slice(-HISTORY_MAX);
        setHistory(next);
        saveHistory(next);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
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

    tick();
    tickVersion();
    timer = setInterval(tick, 30_000);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, []);

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
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "60px 20px" }}>
        <div style={{ marginBottom: 28 }}>
          <Link href="/" style={{ fontSize: 12, color: "#64748b", textDecoration: "none" }}>
            ← AEVION
          </Link>
          <h1 style={{ fontSize: 36, fontWeight: 900, margin: "8px 0", letterSpacing: "-0.02em" }}>
            AEVION Status
          </h1>
          <p style={{ fontSize: 14, color: "#64748b", margin: 0 }}>
            Live health of every product on the planet — polled every 30 seconds.
            Last 60 polls retained locally.
          </p>
        </div>

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
          <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace" }}>
            {lastFetched
              ? new Date(lastFetched).toLocaleTimeString()
              : ""}
          </div>
        </div>

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
          Source: <code>GET /api/aevion/health</code> · Cache 10s ·{" "}
          <Link href="/api/aevion/openapi.json" style={{ color: "#0d9488" }}>
            OpenAPI index
          </Link>
        </div>
      </div>
    </main>
  );
}
