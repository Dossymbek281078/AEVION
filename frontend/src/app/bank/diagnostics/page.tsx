"use client";

/**
 * /bank/diagnostics — operational health board.
 *
 * Complements /bank/smoke (which is a one-shot E2E walk-through):
 * diagnostics is a *continuous* read-out of the four things a bank operator
 * actually wants to know without having to write a transfer:
 *
 *   1. Is each major endpoint reachable, and how fast?
 *      (probes /api/health, /api/auth/me, /api/qtrade/accounts,
 *       /api/qtrade/operations, /api/qsign/sign)
 *   2. What auth state am I in? (anonymous / valid token / expired token)
 *   3. What does my local audit log look like?
 *      (signatures count, per-kind breakdown, oldest / newest entry)
 *   4. What's the deployed environment fingerprint?
 *      (bank mode flag, API base URL, browser, viewport, timezone)
 *
 * Each probe is parallelised, latency-stamped, and re-runnable.
 * The page is layout-noindex'd. For ops use only.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl, getApiBase } from "@/lib/apiBase";
import { loadSignatures, type SignedOperation } from "../_lib/signatures";

const TOKEN_KEY = "aevion_auth_token_v1";

type ProbeStatus = "pending" | "running" | "ok" | "warn" | "fail";

type Probe = {
  key: string;
  label: string;
  path: string;
  needsAuth: boolean;
  ok2xxOnly?: boolean;
  status: ProbeStatus;
  http?: number;
  ms?: number;
  detail?: string;
};

const INITIAL_PROBES: Probe[] = [
  { key: "health", label: "Backend health", path: "/api/health", needsAuth: false, status: "pending" },
  { key: "me", label: "Auth — /api/auth/me", path: "/api/auth/me", needsAuth: true, ok2xxOnly: true, status: "pending" },
  { key: "accounts", label: "Accounts list", path: "/api/qtrade/accounts", needsAuth: true, ok2xxOnly: true, status: "pending" },
  { key: "operations", label: "Operations feed", path: "/api/qtrade/operations", needsAuth: true, ok2xxOnly: true, status: "pending" },
  { key: "summary", label: "Account summary", path: "/api/qtrade/summary", needsAuth: true, ok2xxOnly: true, status: "pending" },
];

function readToken(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

function fmtMs(ms?: number): string {
  if (typeof ms !== "number") return "—";
  if (ms < 10) return `${ms.toFixed(1)} ms`;
  return `${Math.round(ms)} ms`;
}

function statusColor(s: ProbeStatus): string {
  switch (s) {
    case "ok":
      return "#16a34a";
    case "warn":
      return "#d97706";
    case "fail":
      return "#dc2626";
    case "running":
      return "#0ea5e9";
    default:
      return "#94a3b8";
  }
}

function statusLabel(s: ProbeStatus): string {
  switch (s) {
    case "ok":
      return "OK";
    case "warn":
      return "WARN";
    case "fail":
      return "FAIL";
    case "running":
      return "RUNNING";
    default:
      return "PENDING";
  }
}

type EnvSnapshot = {
  bankMode: string;
  apiBase: string;
  ua: string;
  language: string;
  online: boolean;
  viewport: string;
  tz: string;
  buildTs: string;
};

function readEnv(): EnvSnapshot {
  if (typeof window === "undefined") {
    return {
      bankMode: "(server)",
      apiBase: getApiBase(),
      ua: "(server)",
      language: "(server)",
      online: false,
      viewport: "—",
      tz: "—",
      buildTs: new Date().toISOString(),
    };
  }
  const mode = process.env.NEXT_PUBLIC_BANK_MODE?.trim() || "(unset)";
  return {
    bankMode: mode,
    apiBase: getApiBase(),
    ua: navigator.userAgent,
    language: navigator.language || "—",
    online: navigator.onLine,
    viewport: `${window.innerWidth}×${window.innerHeight}`,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "—",
    buildTs: new Date().toISOString(),
  };
}

type SignatureSummary = {
  total: number;
  byKind: Record<string, number>;
  oldest: SignedOperation | null;
  newest: SignedOperation | null;
};

function summariseSignatures(): SignatureSummary {
  const list = loadSignatures();
  const byKind: Record<string, number> = {};
  let oldest: SignedOperation | null = null;
  let newest: SignedOperation | null = null;
  for (const s of list) {
    byKind[s.kind] = (byKind[s.kind] || 0) + 1;
    if (!oldest || s.signedAt < oldest.signedAt) oldest = s;
    if (!newest || s.signedAt > newest.signedAt) newest = s;
  }
  return { total: list.length, byKind, oldest, newest };
}

export default function BankDiagnosticsPage() {
  const [probes, setProbes] = useState<Probe[]>(INITIAL_PROBES);
  const [running, setRunning] = useState(false);
  const [token, setToken] = useState<string>("");
  const [env, setEnv] = useState<EnvSnapshot | null>(null);
  const [sig, setSig] = useState<SignatureSummary>({ total: 0, byKind: {}, oldest: null, newest: null });
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);
  const autoRanRef = useRef(false);

  useEffect(() => {
    setToken(readToken());
    setEnv(readEnv());
    setSig(summariseSignatures());
  }, []);

  const runProbes = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setProbes((prev) => prev.map((p) => ({ ...p, status: "running" as ProbeStatus })));
    const t = readToken();
    setToken(t);

    const results = await Promise.all(
      INITIAL_PROBES.map(async (p) => {
        if (p.needsAuth && !t) {
          return { ...p, status: "warn" as ProbeStatus, detail: "no token (anonymous)" };
        }
        const t0 = performance.now();
        try {
          const r = await fetch(apiUrl(p.path), {
            cache: "no-store",
            headers: t ? { Authorization: `Bearer ${t}` } : undefined,
          });
          const ms = performance.now() - t0;
          const acceptable = p.ok2xxOnly ? r.ok : r.ok || r.status === 404;
          let detail = "";
          if (acceptable) {
            try {
              const ct = r.headers.get("content-type") || "";
              if (ct.includes("application/json")) {
                const j = await r.clone().json();
                if (Array.isArray(j)) detail = `${j.length} items`;
                else if (typeof j === "object" && j !== null) {
                  const keys = Object.keys(j).slice(0, 4).join(", ");
                  detail = keys ? `keys: ${keys}` : "object";
                } else detail = "ok";
              } else {
                detail = "non-json 2xx";
              }
            } catch {
              detail = "ok (parse skipped)";
            }
          } else if (r.status === 401) {
            detail = "unauthorised — token invalid/expired";
          } else if (r.status === 403) {
            detail = "forbidden";
          } else if (r.status >= 500) {
            detail = `server error ${r.status}`;
          } else {
            detail = `unexpected ${r.status}`;
          }
          return {
            ...p,
            status: acceptable ? ("ok" as ProbeStatus) : ("fail" as ProbeStatus),
            ms,
            http: r.status,
            detail,
          };
        } catch (err: unknown) {
          const ms = performance.now() - t0;
          return {
            ...p,
            status: "fail" as ProbeStatus,
            ms,
            detail: err instanceof Error ? err.message : "network error",
          };
        }
      }),
    );
    setProbes(results);
    setLastRunAt(new Date().toISOString());
    setRunning(false);
    setSig(summariseSignatures());
  }, [running]);

  useEffect(() => {
    if (autoRanRef.current) return;
    autoRanRef.current = true;
    void runProbes();
  }, [runProbes]);

  const summary = useMemo(() => {
    let ok = 0;
    let warn = 0;
    let fail = 0;
    let totalMs = 0;
    let counted = 0;
    for (const p of probes) {
      if (p.status === "ok") ok++;
      else if (p.status === "warn") warn++;
      else if (p.status === "fail") fail++;
      if (typeof p.ms === "number") {
        totalMs += p.ms;
        counted++;
      }
    }
    const avg = counted > 0 ? totalMs / counted : 0;
    return { ok, warn, fail, avg };
  }, [probes]);

  const overall: ProbeStatus = useMemo(() => {
    if (running) return "running";
    if (summary.fail > 0) return "fail";
    if (summary.warn > 0) return "warn";
    if (summary.ok > 0) return "ok";
    return "pending";
  }, [running, summary]);

  const authState = useMemo<{
    label: string;
    color: string;
    detail: string;
  }>(() => {
    if (!token) return { label: "ANONYMOUS", color: "#94a3b8", detail: "no token in localStorage" };
    const meProbe = probes.find((p) => p.key === "me");
    if (!meProbe || meProbe.status === "pending" || meProbe.status === "running") {
      return { label: "CHECKING", color: "#0ea5e9", detail: "verifying token" };
    }
    if (meProbe.status === "ok") return { label: "VALID", color: "#16a34a", detail: "token resolves to a user" };
    return { label: "EXPIRED", color: "#dc2626", detail: meProbe.detail || "token rejected by /api/auth/me" };
  }, [token, probes]);

  return (
    <main>
      <ProductPageShell maxWidth={960}>
        <Wave1Nav />

        <header style={{ padding: "32px 0 18px" }}>
          <div
            style={{
              display: "inline-block",
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#64748b",
              marginBottom: 10,
            }}
          >
            Operational health board
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 900, margin: "0 0 8px", letterSpacing: "-0.01em" }}>
            Bank diagnostics
          </h1>
          <p style={{ fontSize: 15, color: "#475569", lineHeight: 1.55, maxWidth: 640, margin: 0 }}>
            Continuous read-out of backend reachability, endpoint latency, auth state and
            local audit log. Re-runs automatically on load; click <em>Re-run probes</em> to
            refresh. For engineers and on-call only.
          </p>
        </header>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
            margin: "8px 0 22px",
          }}
        >
          <SummaryTile label="Overall" value={statusLabel(overall)} color={statusColor(overall)} />
          <SummaryTile label="Probes ok" value={`${summary.ok}/${probes.length}`} color="#16a34a" />
          <SummaryTile label="Avg latency" value={fmtMs(summary.avg)} color="#0ea5e9" />
          <SummaryTile label="Auth" value={authState.label} color={authState.color} />
        </section>

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            margin: "0 0 18px",
            alignItems: "center",
          }}
        >
          <button
            type="button"
            onClick={() => void runProbes()}
            disabled={running}
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              background: running ? "#94a3b8" : "#0f172a",
              color: "#fff",
              border: "none",
              cursor: running ? "default" : "pointer",
            }}
          >
            {running ? "Probing…" : "↻ Re-run probes"}
          </button>
          <Link
            href="/bank/smoke"
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              background: "rgba(15,23,42,0.06)",
              color: "#0f172a",
              textDecoration: "none",
              border: "1px solid rgba(15,23,42,0.10)",
            }}
          >
            ✦ Run E2E smoke
          </Link>
          <Link
            href="/bank/audit-log"
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              background: "rgba(15,23,42,0.06)",
              color: "#0f172a",
              textDecoration: "none",
              border: "1px solid rgba(15,23,42,0.10)",
            }}
          >
            ✎ Open audit log
          </Link>
          {lastRunAt ? (
            <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>
              Last run: {new Date(lastRunAt).toLocaleTimeString()}
            </span>
          ) : null}
        </div>

        <Section title="Endpoint probes" subtitle="Each probe runs in parallel; latency is wall-clock from request start to response.">
          <div
            style={{
              border: "1px solid rgba(15,23,42,0.08)",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "rgba(15,23,42,0.03)" }}>
                  <th style={thStyle}>Endpoint</th>
                  <th style={thStyle}>Path</th>
                  <th style={thStyle}>HTTP</th>
                  <th style={thStyle}>Latency</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Detail</th>
                </tr>
              </thead>
              <tbody>
                {probes.map((p) => (
                  <tr key={p.key} style={{ borderTop: "1px solid rgba(15,23,42,0.05)" }}>
                    <td style={tdStyle}>
                      <strong>{p.label}</strong>
                      {p.needsAuth ? <span style={authBadgeStyle}>auth</span> : null}
                    </td>
                    <td style={{ ...tdStyle, fontFamily: "ui-monospace, monospace", fontSize: 12 }}>{p.path}</td>
                    <td style={tdStyle}>{p.http ?? "—"}</td>
                    <td style={tdStyle}>{fmtMs(p.ms)}</td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontSize: 10,
                          fontWeight: 800,
                          letterSpacing: "0.06em",
                          color: "#fff",
                          background: statusColor(p.status),
                        }}
                      >
                        {statusLabel(p.status)}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, color: "#475569" }}>{p.detail || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Auth state" subtitle="Token is read from localStorage and verified via /api/auth/me.">
          <KvList
            rows={[
              { k: "Token present", v: token ? "yes" : "no" },
              { k: "Token preview", v: token ? `${token.slice(0, 8)}…${token.slice(-4)}` : "—" },
              { k: "Token length", v: token ? String(token.length) : "—" },
              { k: "/api/auth/me", v: authState.label, color: authState.color },
              { k: "Detail", v: authState.detail },
            ]}
          />
        </Section>

        <Section title="Local audit log" subtitle="QSign signatures persisted in this browser. Same store rendered on /bank/audit-log.">
          <KvList
            rows={[
              { k: "Total signatures", v: String(sig.total) },
              { k: "Top-ups signed", v: String(sig.byKind["topup"] || 0) },
              { k: "Transfers signed", v: String(sig.byKind["transfer"] || 0) },
              { k: "Oldest", v: sig.oldest ? new Date(sig.oldest.signedAt).toLocaleString() : "—" },
              { k: "Newest", v: sig.newest ? new Date(sig.newest.signedAt).toLocaleString() : "—" },
            ]}
          />
        </Section>

        <Section title="Environment" subtitle="Read at page load. Useful to attach to bug reports.">
          {env ? (
            <KvList
              rows={[
                { k: "Bank mode", v: env.bankMode, color: env.bankMode === "production" ? "#16a34a" : "#d97706" },
                { k: "API base", v: env.apiBase },
                { k: "Online", v: env.online ? "yes" : "no", color: env.online ? "#16a34a" : "#dc2626" },
                { k: "Viewport", v: env.viewport },
                { k: "Language", v: env.language },
                { k: "Timezone", v: env.tz },
                { k: "User agent", v: env.ua },
              ]}
            />
          ) : null}
        </Section>

        <footer style={{ margin: "32px 0 16px", fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>
          <p style={{ margin: "0 0 4px" }}>
            <strong>Why this page?</strong> /bank/smoke <em>writes</em> to the backend (registers a user,
            top-ups, transfers, signs). This page is read-only and safe to run as often as you like.
          </p>
          <p style={{ margin: 0 }}>
            <strong>Hidden from search:</strong> robots noindex,nofollow. Operational tool only.
          </p>
        </footer>
      </ProductPageShell>
    </main>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "#475569",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 12px",
  verticalAlign: "middle",
};

const authBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  marginLeft: 8,
  padding: "1px 6px",
  borderRadius: 4,
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  background: "rgba(14,165,233,0.10)",
  color: "#0369a1",
};

function SummaryTile({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div
      style={{
        padding: "14px 16px",
        borderRadius: 12,
        background: "rgba(15,23,42,0.03)",
        border: "1px solid rgba(15,23,42,0.06)",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "#64748b",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 900, color, letterSpacing: "-0.01em" }}>{value}</div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ margin: "10px 0 22px" }}>
      <h2 style={{ fontSize: 17, fontWeight: 800, margin: "0 0 4px", letterSpacing: "-0.005em" }}>{title}</h2>
      {subtitle ? (
        <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 12px", lineHeight: 1.5 }}>{subtitle}</p>
      ) : null}
      {children}
    </section>
  );
}

function KvList({
  rows,
}: {
  rows: Array<{ k: string; v: string; color?: string }>;
}) {
  return (
    <div
      style={{
        border: "1px solid rgba(15,23,42,0.08)",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      {rows.map((row, i) => (
        <div
          key={row.k}
          style={{
            display: "grid",
            gridTemplateColumns: "180px 1fr",
            gap: 12,
            padding: "10px 14px",
            fontSize: 13,
            borderTop: i === 0 ? "none" : "1px solid rgba(15,23,42,0.05)",
            background: i % 2 === 0 ? "transparent" : "rgba(15,23,42,0.02)",
          }}
        >
          <div style={{ color: "#64748b", fontWeight: 600 }}>{row.k}</div>
          <div
            style={{
              color: row.color || "#0f172a",
              fontFamily: "ui-monospace, monospace",
              fontSize: 12,
              wordBreak: "break-all",
              fontWeight: row.color ? 800 : 500,
            }}
          >
            {row.v}
          </div>
        </div>
      ))}
    </div>
  );
}
