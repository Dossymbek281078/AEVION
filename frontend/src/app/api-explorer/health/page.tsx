"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiUrl, getApiBase } from "@/lib/apiBase";

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

type LatencyStore = Record<string, number[]>;

const LATENCY_KEY = "aevion_health_latency_v1";
const LATENCY_MAX = 30;
const POLL_MS = 15_000;

function loadLatency(): LatencyStore {
  try {
    const raw = localStorage.getItem(LATENCY_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const out: LatencyStore = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (Array.isArray(v)) {
        const nums = v.filter((n): n is number => typeof n === "number" && Number.isFinite(n));
        out[k] = nums.slice(-LATENCY_MAX);
      }
    }
    return out;
  } catch {
    return {};
  }
}

function saveLatency(store: LatencyStore): void {
  try {
    const trimmed: LatencyStore = {};
    for (const [k, v] of Object.entries(store)) {
      trimmed[k] = v.slice(-LATENCY_MAX);
    }
    localStorage.setItem(LATENCY_KEY, JSON.stringify(trimmed));
  } catch {
    /* ignore */
  }
}

function statsFor(series: number[]): { current: number; avg: number; min: number; max: number } | null {
  if (series.length === 0) return null;
  const current = series[series.length - 1];
  let sum = 0;
  let min = Infinity;
  let max = -Infinity;
  for (const n of series) {
    sum += n;
    if (n < min) min = n;
    if (n > max) max = n;
  }
  return {
    current,
    avg: Math.round(sum / series.length),
    min,
    max,
  };
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) {
    return (
      <div
        style={{
          height: 32,
          display: "flex",
          alignItems: "center",
          fontSize: 10,
          color: "#94a3b8",
          fontFamily: "monospace",
        }}
      >
        collecting…
      </div>
    );
  }
  const w = 100;
  const h = 32;
  let min = Infinity;
  let max = -Infinity;
  for (const n of data) {
    if (n < min) min = n;
    if (n > max) max = n;
  }
  const range = max - min || 1;
  const step = data.length > 1 ? w / (data.length - 1) : 0;
  const points = data
    .map((n, i) => {
      const x = i * step;
      const y = h - ((n - min) / range) * (h - 2) - 1;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  const last = data[data.length - 1];
  const lastX = (data.length - 1) * step;
  const lastY = h - ((last - min) / range) * (h - 2) - 1;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      style={{ width: "100%", height: h, display: "block" }}
      aria-hidden
    >
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.4} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lastX} cy={lastY} r={2} fill={color} />
    </svg>
  );
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

export default function HealthExplorerPage() {
  const [data, setData] = useState<HubResponse | null>(null);
  const [latency, setLatency] = useState<LatencyStore>({});
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const apiBase = getApiBase();
  const fullUrl = `${apiBase}/api/aevion/health`;
  const curl = `curl -s '${fullUrl}' | jq .`;
  const sdk = `import { AevionCatalog } from "@aevion-io/catalog-client";
const cat = new AevionCatalog();
const { status, healthy, total, services } = await cat.health();
// status: "ok" | "degraded" | "down"
// services: Record<string, { ok, status, durationMs, summary }>`;

  useEffect(() => {
    setLatency(loadLatency());
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      setLoading(true);
      try {
        const res = await fetch(apiUrl("/api/aevion/health"));
        if (!res.ok) throw new Error("HTTP " + res.status);
        const json = (await res.json()) as HubResponse;
        if (cancelled) return;
        setData(json);
        setError(null);
        setLastFetched(Date.now());

        const prev = loadLatency();
        const next: LatencyStore = { ...prev };
        for (const [key, svc] of Object.entries(json.services)) {
          const arr = next[key] ? [...next[key]] : [];
          arr.push(svc.durationMs);
          next[key] = arr.slice(-LATENCY_MAX);
        }
        setLatency(next);
        saveLatency(next);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void tick();
    const timer = setInterval(tick, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const copy = (text: string, key: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const overallColor = useMemo(() => {
    if (data?.status === "ok") return "#10b981";
    if (data?.status === "degraded") return "#f59e0b";
    if (data?.status === "down") return "#ef4444";
    return "#64748b";
  }, [data?.status]);

  const overallLabel = useMemo(() => {
    if (!data) return error ? "Probe failed" : "Loading…";
    if (data.status === "ok") return "All systems operational";
    if (data.status === "degraded") return "Partial service outage";
    return "Major outage";
  }, [data, error]);

  const services = useMemo(() => (data ? Object.entries(data.services) : []), [data]);

  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", color: "#0f172a" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 20px" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/developers" style={{ fontSize: 12, color: "#64748b", textDecoration: "none" }}>
            ← Developers
          </Link>
          <h1 style={{ fontSize: 34, fontWeight: 900, margin: "8px 0", letterSpacing: "-0.02em" }}>
            Hub health explorer
          </h1>
          <p style={{ fontSize: 14, color: "#64748b", margin: 0, lineHeight: 1.6, maxWidth: 720 }}>
            Live dev dashboard for{" "}
            <code style={{ background: "rgba(15,23,42,0.06)", padding: "1px 6px", borderRadius: 4 }}>
              GET /api/aevion/health
            </code>
            . Polled every 15s. Per-service HTTP code, latency, summary, plus a {LATENCY_MAX}-point local
            sparkline so you can spot regressions while you work. For a customer-facing view, see{" "}
            <Link href="/status" style={{ color: "#0d9488", textDecoration: "none" }}>
              /status
            </Link>
            .
          </p>
        </div>

        {/* How to consume */}
        <div style={{ display: "grid", gap: 10, marginBottom: 18 }}>
          {[
            { label: "URL", body: fullUrl, key: "url" },
            { label: "curl", body: curl, key: "curl" },
            { label: "@aevion-io/catalog-client", body: sdk, key: "sdk" },
          ].map((s) => (
            <div
              key={s.key}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                background: "#0f172a",
                color: "#e2e8f0",
                border: "1px solid rgba(13,148,136,0.4)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span
                  style={{
                    fontSize: 10,
                    color: "#94a3b8",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  {s.label}
                </span>
                <button
                  type="button"
                  onClick={() => copy(s.body, s.key)}
                  style={{
                    marginLeft: "auto",
                    padding: "3px 10px",
                    borderRadius: 6,
                    background: copied === s.key ? "#10b981" : "rgba(255,255,255,0.08)",
                    color: copied === s.key ? "#0f172a" : "#e2e8f0",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 10,
                    fontWeight: 800,
                  }}
                >
                  {copied === s.key ? "Copied" : "Copy"}
                </button>
              </div>
              <pre
                style={{
                  margin: 0,
                  fontSize: 12,
                  fontFamily: "ui-monospace, SFMono-Regular, monospace",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                  lineHeight: 1.5,
                }}
              >
                {s.body}
              </pre>
            </div>
          ))}
        </div>

        {/* Overall banner */}
        <div
          style={{
            padding: "22px 26px",
            borderRadius: 14,
            background: "#fff",
            border: `1px solid ${overallColor}40`,
            marginBottom: 18,
            display: "flex",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: 999,
              background: overallColor,
              boxShadow: `0 0 0 5px ${overallColor}25`,
            }}
            aria-hidden
          />
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: overallColor }}>{overallLabel}</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
              {data
                ? `${data.healthy}/${data.total} services responding`
                : error
                  ? `Probe failed: ${error}`
                  : "Connecting to /api/aevion/health…"}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              gap: 14,
              alignItems: "center",
              fontSize: 11,
              color: "#94a3b8",
              fontFamily: "monospace",
            }}
          >
            {loading && <span style={{ color: "#0d9488" }}>polling…</span>}
            <span>poll {POLL_MS / 1000}s</span>
            {lastFetched && <span>last {new Date(lastFetched).toLocaleTimeString()}</span>}
          </div>
        </div>

        {/* Per-service grid */}
        {services.length > 0 && (
          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              marginBottom: 18,
            }}
          >
            {services.map(([key, svc]) => {
              const label = SERVICE_LABELS[key] || key;
              const c = svc.ok ? "#10b981" : "#ef4444";
              const summary = svc.summary || {};
              const series = latency[key] || [];
              const stat = statsFor(series);
              return (
                <div
                  key={key}
                  style={{
                    padding: "14px 16px",
                    borderRadius: 12,
                    background: "#fff",
                    border: `1px solid ${c}30`,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 999,
                        background: c,
                        boxShadow: `0 0 0 4px ${c}20`,
                        flexShrink: 0,
                      }}
                      aria-hidden
                    />
                    <div style={{ fontWeight: 800, fontSize: 14, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {label}
                    </div>
                    <span
                      style={{
                        fontSize: 10,
                        fontFamily: "monospace",
                        fontWeight: 800,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: svc.ok ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
                        color: c,
                      }}
                    >
                      {svc.status || "—"}
                    </span>
                  </div>

                  <div>
                    <Sparkline data={series} color={c} />
                  </div>

                  {stat ? (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(4, 1fr)",
                        gap: 4,
                        fontSize: 10,
                        fontFamily: "monospace",
                        color: "#475569",
                      }}
                    >
                      <div>
                        <div style={{ color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", fontSize: 9 }}>
                          now
                        </div>
                        <div style={{ color: "#0f172a", fontWeight: 700 }}>{stat.current}ms</div>
                      </div>
                      <div>
                        <div style={{ color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", fontSize: 9 }}>
                          avg
                        </div>
                        <div style={{ color: "#0f172a", fontWeight: 700 }}>{stat.avg}ms</div>
                      </div>
                      <div>
                        <div style={{ color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", fontSize: 9 }}>
                          min
                        </div>
                        <div style={{ color: "#0f172a", fontWeight: 700 }}>{stat.min}ms</div>
                      </div>
                      <div>
                        <div style={{ color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", fontSize: 9 }}>
                          max
                        </div>
                        <div style={{ color: "#0f172a", fontWeight: 700 }}>{stat.max}ms</div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace" }}>
                      latency: {svc.durationMs}ms
                    </div>
                  )}

                  {svc.ok && Object.keys(summary).length > 0 && (
                    <div
                      style={{
                        padding: "6px 8px",
                        borderRadius: 6,
                        background: "#f8fafc",
                        fontSize: 10,
                        fontFamily: "monospace",
                        color: "#475569",
                        wordBreak: "break-all",
                        lineHeight: 1.5,
                      }}
                    >
                      {Object.entries(summary)
                        .slice(0, 4)
                        .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
                        .join(" · ")}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!data && !error && (
          <div
            style={{
              padding: "32px 24px",
              borderRadius: 12,
              background: "#fff",
              border: "1px solid rgba(15,23,42,0.08)",
              textAlign: "center",
              fontSize: 13,
              color: "#94a3b8",
            }}
          >
            Connecting to /api/aevion/health…
          </div>
        )}

        <div
          style={{
            padding: "12px 14px",
            borderRadius: 10,
            background: "rgba(13,148,136,0.06)",
            border: "1px solid rgba(13,148,136,0.18)",
            marginTop: 14,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: "#0d9488",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 6,
            }}
          >
            Tip
          </div>
          <div style={{ fontSize: 12.5, color: "#475569", lineHeight: 1.6 }}>
            Latency series are kept in <code style={{ background: "rgba(15,23,42,0.06)", padding: "1px 5px", borderRadius: 4 }}>localStorage</code>{" "}
            (key <code style={{ background: "rgba(15,23,42,0.06)", padding: "1px 5px", borderRadius: 4 }}>{LATENCY_KEY}</code>) — last {LATENCY_MAX} polls per service.
            Each summary field is the upstream module&apos;s own self-report (counts, queue depth, version). Hub caches health for ~10s, so two open tabs hit cache.
          </div>
        </div>

        <div style={{ marginTop: 18, fontSize: 11, color: "#94a3b8" }}>
          Source: <code>GET /api/aevion/health</code> ·{" "}
          <Link href="/api-explorer/catalog" style={{ color: "#0d9488" }}>
            Catalog explorer
          </Link>{" "}
          ·{" "}
          <Link href="/api-explorer/badges" style={{ color: "#0d9488" }}>
            Badge builder
          </Link>{" "}
          ·{" "}
          <Link href="/status" style={{ color: "#0d9488" }}>
            Public status page
          </Link>
        </div>
      </div>
    </main>
  );
}
