"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";

type Surface = { name: string; count: number; ok: boolean };

type Health = {
  status: "ok" | "degraded";
  timestamp: number;
  iso: string;
  uptime_ms: number;
  uptime_human: string;
  version: string;
  runtime: string;
  memory_rss_mb: number | null;
  surfaces: Surface[];
};

type ApiCheck = {
  name: string;
  path: string;
  method: "GET" | "POST" | "OPTIONS";
  ok: boolean | null;
  ms: number | null;
  code: number | null;
};

const API_CHECKS: { name: string; path: string; method: ApiCheck["method"] }[] = [
  { name: "Health", path: "/api/health", method: "GET" },
  { name: "OpenAPI spec", path: "/api/openapi.json", method: "GET" },
  { name: "Links list", path: "/api/payments/v1/links", method: "OPTIONS" },
  { name: "Checkout", path: "/api/payments/v1/checkout", method: "OPTIONS" },
  {
    name: "Subscriptions",
    path: "/api/payments/v1/subscriptions",
    method: "OPTIONS",
  },
  { name: "Webhooks", path: "/api/payments/v1/webhooks", method: "OPTIONS" },
  {
    name: "Settlements",
    path: "/api/payments/v1/settlements",
    method: "OPTIONS",
  },
  { name: "Public pay", path: "/api/pay/probe-id", method: "GET" },
];

export default function StatusPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [checks, setChecks] = useState<ApiCheck[]>(
    API_CHECKS.map((c) => ({ ...c, ok: null, ms: null, code: null }))
  );
  const [refreshedAt, setRefreshedAt] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    if (typeof window === "undefined") return;
    setLoading(true);
    try {
      const t0 = performance.now();
      const r = await fetch(`${window.location.origin}/api/health`, {
        cache: "no-store",
      });
      const j = (await r.json()) as Health;
      setHealth(j);
      setHealthError(null);
      void t0;
    } catch (err) {
      setHealthError(err instanceof Error ? err.message : String(err));
      setHealth(null);
    }

    const next: ApiCheck[] = await Promise.all(
      API_CHECKS.map(async (c) => {
        const t0 = performance.now();
        try {
          const r = await fetch(`${window.location.origin}${c.path}`, {
            method: c.method,
            cache: "no-store",
          });
          const ms = Math.round(performance.now() - t0);
          const ok =
            c.method === "OPTIONS"
              ? r.status >= 200 && r.status < 300
              : r.status < 500;
          return { ...c, ok, ms, code: r.status };
        } catch {
          return {
            ...c,
            ok: false,
            ms: Math.round(performance.now() - t0),
            code: 0,
          };
        }
      })
    );
    setChecks(next);
    setRefreshedAt(Date.now());
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
    const t = window.setInterval(refresh, 30_000);
    return () => window.clearInterval(t);
  }, []);

  const allGreen =
    health?.status === "ok" && checks.every((c) => c.ok === true);

  return (
    <main style={{ padding: 0 }}>
      <section
        style={{
          background: allGreen
            ? "linear-gradient(145deg, #064e3b 0%, #047857 60%, #10b981 100%)"
            : "linear-gradient(145deg, #0f172a 0%, #4c1d95 60%, #7c3aed 100%)",
          color: "#fff",
          padding: "32px 24px 38px",
        }}
      >
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <Link
            href="/payments"
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "rgba(255,255,255,0.75)",
              textDecoration: "none",
            }}
          >
            ← Payments Rail
          </Link>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              marginTop: 10,
            }}
          >
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: allGreen ? "#86efac" : "#fcd34d",
                boxShadow: allGreen
                  ? "0 0 12px rgba(134,239,172,0.7)"
                  : "0 0 12px rgba(252,211,77,0.6)",
              }}
            />
            <h1
              style={{
                fontSize: "clamp(22px, 3.6vw, 34px)",
                fontWeight: 800,
                margin: 0,
                letterSpacing: "-0.03em",
              }}
            >
              {allGreen ? "All systems operational" : "Some surfaces degraded"}
            </h1>
          </div>
          <p
            style={{
              fontSize: "clamp(13px, 1.8vw, 16px)",
              opacity: 0.92,
              maxWidth: 720,
              lineHeight: 1.55,
              margin: "12px 0 0",
            }}
          >
            Live checks of /api/health, OpenAPI spec, and every public endpoint
            on the Payments Rail. Auto-refreshes every 30 seconds.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 10,
              marginTop: 22,
            }}
          >
            <Stat
              label="Server status"
              value={health?.status ?? (healthError ? "down" : "…")}
              accent={health?.status === "ok" ? "#86efac" : "#fda4af"}
            />
            <Stat
              label="Uptime"
              value={health?.uptime_human ?? "—"}
              accent="#5eead4"
            />
            <Stat
              label="Version"
              value={health?.version ?? "—"}
              accent="#fcd34d"
            />
            <Stat
              label="RSS"
              value={health?.memory_rss_mb ? `${health.memory_rss_mb} MB` : "—"}
              accent="#c4b5fd"
            />
          </div>
        </div>
      </section>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: 24, display: "grid", gap: 22 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontSize: 12, color: "#64748b" }}>
            {refreshedAt
              ? `Refreshed ${new Date(refreshedAt).toLocaleTimeString()}`
              : "First check pending…"}
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              background: loading ? "#94a3b8" : "#0d9488",
              color: "#fff",
              fontWeight: 800,
              fontSize: 12,
              border: "none",
              cursor: loading ? "wait" : "pointer",
            }}
          >
            {loading ? "Checking…" : "↻ Refresh now"}
          </button>
        </div>

        <section
          style={{
            padding: 22,
            borderRadius: 18,
            border: "1px solid rgba(15,23,42,0.1)",
            background: "#fff",
            boxShadow: "0 2px 12px rgba(15,23,42,0.05)",
            display: "grid",
            gap: 12,
          }}
        >
          <h2
            style={{
              fontSize: 18,
              fontWeight: 900,
              margin: 0,
              letterSpacing: "-0.02em",
              color: "#0f172a",
            }}
          >
            Endpoint checks
          </h2>
          <div style={{ display: "grid", gap: 6 }}>
            {checks.map((c) => (
              <div
                key={c.path}
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr auto auto",
                  gap: 10,
                  alignItems: "center",
                  padding: "10px 12px",
                  borderRadius: 10,
                  background:
                    c.ok === true
                      ? "rgba(5,150,105,0.05)"
                      : c.ok === false
                      ? "rgba(220,38,38,0.05)"
                      : "rgba(15,23,42,0.03)",
                  border:
                    c.ok === true
                      ? "1px solid rgba(5,150,105,0.18)"
                      : c.ok === false
                      ? "1px solid rgba(220,38,38,0.18)"
                      : "1px solid rgba(15,23,42,0.08)",
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background:
                      c.ok === true
                        ? "#10b981"
                        : c.ok === false
                        ? "#ef4444"
                        : "#94a3b8",
                  }}
                />
                <span style={{ minWidth: 0 }}>
                  <span style={{ fontWeight: 800, fontSize: 13, color: "#0f172a" }}>
                    {c.name}
                  </span>
                  <span
                    style={{
                      marginLeft: 8,
                      fontFamily:
                        "ui-monospace, SFMono-Regular, Menlo, monospace",
                      fontSize: 11,
                      color: "#64748b",
                    }}
                  >
                    {c.method} {c.path}
                  </span>
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: "#64748b",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {c.ms !== null ? `${c.ms}ms` : "—"}
                </span>
                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: 5,
                    background:
                      c.ok === true
                        ? "rgba(5,150,105,0.15)"
                        : c.ok === false
                        ? "rgba(220,38,38,0.15)"
                        : "rgba(15,23,42,0.06)",
                    color:
                      c.ok === true
                        ? "#047857"
                        : c.ok === false
                        ? "#b91c1c"
                        : "#475569",
                    fontSize: 11,
                    fontWeight: 800,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {c.code ?? "…"}
                </span>
              </div>
            ))}
          </div>
        </section>

        {health && (
          <section
            style={{
              padding: 22,
              borderRadius: 18,
              border: "1px solid rgba(15,23,42,0.1)",
              background: "#fff",
              boxShadow: "0 2px 12px rgba(15,23,42,0.05)",
              display: "grid",
              gap: 12,
            }}
          >
            <h2
              style={{
                fontSize: 18,
                fontWeight: 900,
                margin: 0,
                letterSpacing: "-0.02em",
                color: "#0f172a",
              }}
            >
              Surface counts (in-memory store)
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 8,
              }}
            >
              {health.surfaces.map((s) => (
                <div
                  key={s.name}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 10,
                    background: s.ok
                      ? "rgba(15,23,42,0.03)"
                      : "rgba(245,158,11,0.06)",
                    border: s.ok
                      ? "1px solid rgba(15,23,42,0.08)"
                      : "1px solid rgba(245,158,11,0.2)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#475569",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {s.name}
                  </div>
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 900,
                      color: "#0f172a",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {s.count}
                  </div>
                </div>
              ))}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "#94a3b8",
                marginTop: 4,
              }}
            >
              The store is module-level memory keyed off globalThis. Counts
              reset on each cold start (Vercel ≈ every few minutes of idle).
              Persistence migration to Vercel KV / Postgres is on the v1.3
              roadmap.
            </div>
          </section>
        )}

        {healthError && (
          <div
            style={{
              padding: 14,
              borderRadius: 10,
              background: "rgba(220,38,38,0.06)",
              border: "1px solid rgba(220,38,38,0.2)",
              color: "#b91c1c",
              fontSize: 13,
            }}
          >
            <strong>Health endpoint unreachable:</strong> {healthError}
          </div>
        )}
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 12,
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.12)",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: accent,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 900, color: "#fff" }}>
        {value}
      </div>
    </div>
  );
}

const _statCardStyle: CSSProperties = {};
void _statCardStyle;
