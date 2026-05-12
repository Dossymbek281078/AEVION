import type { Metadata } from "next";
import Link from "next/link";

// Zone: aevion-core/main owns frontend/src/app/developers/fintech/**

export const metadata: Metadata = {
  title: "AEVION Fintech Rate Limits — per-endpoint quotas + backoff guide",
  description:
    "Per-endpoint rate limits for the AEVION fintech API: write quotas, public read quotas, partner-tier overrides, retry-after handling, exponential backoff sample code.",
  alternates: { canonical: "https://aevion.app/developers/fintech/rate-limits" },
  robots: { index: true, follow: true },
};

const C = {
  bg: "#0f172a", panel: "#1e293b", border: "#334155",
  text: "#f1f5f9", dim: "#94a3b8", faint: "#64748b",
  accent: "#a78bfa", green: "#34d399", red: "#ef4444", yellow: "#fbbf24",
  cyan: "#22d3ee",
};

type Tier = { name: string; writes: string; reads: string; bursts: string; cost: string };

const TIERS: Tier[] = [
  { name: "Anonymous", writes: "— (auth required)", reads: "300 req/min", bursts: "60 req/10s", cost: "Free" },
  { name: "Authenticated", writes: "60 req/min", reads: "600 req/min", bursts: "120 req/10s", cost: "Free" },
  { name: "Partner", writes: "300 req/min", reads: "3000 req/min", bursts: "600 req/10s", cost: "Contact" },
  { name: "Enterprise", writes: "Custom", reads: "Custom", bursts: "Custom", cost: "SLA" },
];

type EndpointBucket = {
  module: string;
  color: string;
  buckets: { path: string; method: string; limit: string; note?: string }[];
};

const BUCKETS: EndpointBucket[] = [
  {
    module: "QGood",
    color: "#34d399",
    buckets: [
      { path: "/api/qgood/campaigns", method: "GET",  limit: "600/min", note: "Public, cached 30s" },
      { path: "/api/qgood/donate",    method: "POST", limit: "30/min",  note: "Stripe-gated, idempotency-key required" },
      { path: "/api/qgood/stats",     method: "GET",  limit: "300/min", note: "Cached 60s upstream" },
    ],
  },
  {
    module: "QMaskCard",
    color: "#c4b5fd",
    buckets: [
      { path: "/api/qmaskcard/issue",   method: "POST", limit: "20/min", note: "Single-use mask cost-gated" },
      { path: "/api/qmaskcard/charge",  method: "POST", limit: "60/min", note: "Per-mask 1 charge until revoke" },
      { path: "/api/qmaskcard/me/list", method: "GET",  limit: "120/min" },
    ],
  },
  {
    module: "VeilNetX",
    color: "#a78bfa",
    buckets: [
      { path: "/api/veilnetx-ledger/head",          method: "GET",  limit: "1200/min", note: "Public, very hot — cached 5s" },
      { path: "/api/veilnetx-ledger/chain/verify",  method: "GET",  limit: "10/min",   note: "Expensive — re-hashes full chain" },
      { path: "/api/veilnetx-ledger/search",        method: "GET",  limit: "120/min",  note: "Hash-prefix lookup" },
    ],
  },
  {
    module: "Z-Tide",
    color: "#fbbf24",
    buckets: [
      { path: "/api/ztide/leaderboard",   method: "GET",  limit: "600/min", note: "Public, cached 60s" },
      { path: "/api/ztide/me",            method: "GET",  limit: "120/min" },
      { path: "/api/ztide/claim-streak",  method: "POST", limit: "1/20h",   note: "Per-user 20-hour cooldown" },
    ],
  },
  {
    module: "QChainGov",
    color: "#f472b6",
    buckets: [
      { path: "/api/qchaingov/proposals",            method: "GET",  limit: "600/min", note: "Public, cached 30s" },
      { path: "/api/qchaingov/proposals/:id/vote",   method: "POST", limit: "6/min",   note: "1 vote per user per proposal (UNIQUE)" },
      { path: "/api/qchaingov/proposals/:id/execute",method: "POST", limit: "10/min",  note: "Admin-only, audited" },
    ],
  },
];

function MethodPill({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: C.green, POST: C.accent, PATCH: C.cyan, DELETE: C.yellow,
  };
  return (
    <span style={{
      display: "inline-block",
      minWidth: 50,
      textAlign: "center",
      fontSize: 10,
      fontWeight: 800,
      letterSpacing: 0.4,
      padding: "2px 6px",
      borderRadius: 4,
      background: `${colors[method] ?? "#64748b"}20`,
      color: colors[method] ?? "#94a3b8",
      fontFamily: "ui-monospace, monospace",
    }}>{method}</span>
  );
}

export default function RateLimitsPage() {
  return (
    <main style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "system-ui, sans-serif", padding: "32px 16px" }}>
      <article style={{ maxWidth: 880, margin: "0 auto" }}>
        {/* Breadcrumb */}
        <div style={{ fontSize: 12, color: C.faint, marginBottom: 16 }}>
          <Link href="/developers/fintech" style={{ color: C.dim, textDecoration: "none" }}>Fintech API</Link>
          {" / "}<span style={{ color: C.text }}>Rate limits</span>
        </div>

        <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.02em", margin: "0 0 8px" }}>
          Rate limits
        </h1>
        <p style={{ fontSize: 14, color: C.dim, margin: "0 0 32px", lineHeight: 1.65 }}>
          Per-endpoint quotas + tier overrides. All limits apply per-IP for anonymous traffic and per-user
          for authenticated traffic. Limits are sliding-window, not fixed-window.
        </p>

        {/* Tier table */}
        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: C.text, margin: "0 0 12px" }}>Tier overview</h2>
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "rgba(167,139,250,0.08)" }}>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 800, color: C.accent, textTransform: "uppercase", letterSpacing: 0.5 }}>Tier</th>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 800, color: C.accent, textTransform: "uppercase", letterSpacing: 0.5 }}>Writes</th>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 800, color: C.accent, textTransform: "uppercase", letterSpacing: 0.5 }}>Reads</th>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 800, color: C.accent, textTransform: "uppercase", letterSpacing: 0.5 }}>Bursts</th>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 800, color: C.accent, textTransform: "uppercase", letterSpacing: 0.5 }}>Cost</th>
                </tr>
              </thead>
              <tbody>
                {TIERS.map((t, i) => (
                  <tr key={t.name} style={{ borderTop: i === 0 ? "none" : `1px solid ${C.border}` }}>
                    <td style={{ padding: "10px 14px", fontWeight: 700, color: C.text }}>{t.name}</td>
                    <td style={{ padding: "10px 14px", color: C.dim, fontFamily: "ui-monospace, monospace", fontSize: 12 }}>{t.writes}</td>
                    <td style={{ padding: "10px 14px", color: C.dim, fontFamily: "ui-monospace, monospace", fontSize: 12 }}>{t.reads}</td>
                    <td style={{ padding: "10px 14px", color: C.dim, fontFamily: "ui-monospace, monospace", fontSize: 12 }}>{t.bursts}</td>
                    <td style={{ padding: "10px 14px", color: C.dim }}>{t.cost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Per-module endpoint buckets */}
        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: C.text, margin: "0 0 12px" }}>Per-endpoint buckets</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {BUCKETS.map((b) => (
              <div key={b.module} style={{
                background: C.panel,
                border: `1px solid ${C.border}`,
                borderLeft: `3px solid ${b.color}`,
                borderRadius: 10,
                padding: "14px 18px",
              }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: b.color, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
                  {b.module}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {b.buckets.map((e) => (
                    <div key={e.path + e.method} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, lineHeight: 1.5 }}>
                      <MethodPill method={e.method} />
                      <code style={{ color: C.text, fontFamily: "ui-monospace, monospace", fontSize: 12, flex: 1 }}>{e.path}</code>
                      <span style={{ color: C.green, fontFamily: "ui-monospace, monospace", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>{e.limit}</span>
                    </div>
                  ))}
                </div>
                {b.buckets.some((x) => x.note) && (
                  <ul style={{ margin: "10px 0 0", paddingLeft: 20, fontSize: 11, color: C.faint, lineHeight: 1.6 }}>
                    {b.buckets.filter((x) => x.note).map((x, i) => (
                      <li key={i}><code style={{ color: C.dim, fontFamily: "ui-monospace, monospace" }}>{x.path}</code>: {x.note}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Headers */}
        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: C.text, margin: "0 0 12px" }}>Response headers</h2>
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 18px" }}>
            <ul style={{ margin: 0, paddingLeft: 22, fontSize: 13, color: C.dim, lineHeight: 1.8 }}>
              <li><code style={{ color: C.cyan, fontFamily: "ui-monospace, monospace" }}>X-RateLimit-Limit</code> — quota per window</li>
              <li><code style={{ color: C.cyan, fontFamily: "ui-monospace, monospace" }}>X-RateLimit-Remaining</code> — remaining in current window</li>
              <li><code style={{ color: C.cyan, fontFamily: "ui-monospace, monospace" }}>X-RateLimit-Reset</code> — Unix seconds when window resets</li>
              <li><code style={{ color: C.cyan, fontFamily: "ui-monospace, monospace" }}>Retry-After</code> — only on 429, seconds to wait</li>
            </ul>
          </div>
        </section>

        {/* Backoff sample */}
        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: C.text, margin: "0 0 12px" }}>Backoff pattern (TypeScript)</h2>
          <pre style={{
            background: "#020617",
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            padding: "16px 18px",
            margin: 0,
            fontSize: 12,
            lineHeight: 1.6,
            color: "#a5f3fc",
            fontFamily: "ui-monospace, monospace",
            overflowX: "auto",
          }}>{`async function aevFetch(url: string, init: RequestInit = {}, attempt = 0): Promise<Response> {
  const r = await fetch(url, init);
  if (r.status !== 429 || attempt >= 5) return r;

  const retryAfter = Number(r.headers.get("retry-after") ?? "0");
  const wait = retryAfter > 0
    ? retryAfter * 1000
    : Math.min(2 ** attempt * 1000 + Math.random() * 250, 30_000);

  await new Promise((res) => setTimeout(res, wait));
  return aevFetch(url, init, attempt + 1);
}`}</pre>
        </section>

        {/* Bypass partner-tier */}
        <div style={{ marginTop: 36, padding: "16px 20px", background: C.panel, borderRadius: 12, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 8 }}>Need higher limits?</div>
          <div style={{ fontSize: 13, color: C.dim, lineHeight: 1.65 }}>
            Partner tier unlocks 5× write and 5× read quotas plus dedicated rate-limit pools per integration.
            Contact <a href="mailto:support@aevion.app" style={{ color: C.accent, textDecoration: "none" }}>support@aevion.app</a>
            {" "}with your use case, expected RPM, and integration name.
          </div>
        </div>

        {/* Related */}
        <div style={{ marginTop: 24, display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13 }}>
          <Link href="/developers/fintech" style={{ color: C.accent, textDecoration: "none" }}>← API Reference</Link>
          <Link href="/developers/fintech/troubleshooting" style={{ color: C.accent, textDecoration: "none" }}>🔧 Troubleshooting</Link>
          <Link href="/developers/fintech/errors" style={{ color: C.accent, textDecoration: "none" }}>⚠️ Error codes</Link>
        </div>
      </article>
    </main>
  );
}
