import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "AEVION Fintech — Rate Limits",
  description: "Rate limits, quotas, and backoff strategies for AEVION fintech APIs across all four tiers.",
  alternates: { canonical: "https://aevion.app/developers/fintech/rate-limits" },
};

const C = { bg: "#050810", surface: "#0d1117", border: "#1e2a3a", text: "#e2e8f0", muted: "#64748b", code: "#0f1923", accent: "#6366f1", green: "#10b981", amber: "#f59e0b", red: "#ef4444" };

const TIERS = [
  { name: "Developer", price: "Free",    perMin: 100,  perMonth: "10K",   burst: 150,  concurrency: 5 },
  { name: "Build",     price: "$49/mo",  perMin: 500,  perMonth: "100K",  burst: 750,  concurrency: 20 },
  { name: "Scale",     price: "$199/mo", perMin: 2000, perMonth: "1M",    burst: 3000, concurrency: 100 },
  { name: "Enterprise",price: "Custom",  perMin: null, perMonth: "∞",     burst: null, concurrency: null },
];

const MODULE_LIMITS = [
  { module: "QPayNet",    writePerMin: 30,  readPerMin: 200, note: "Transfer & deposit endpoints share the write bucket" },
  { module: "VeilNetX",   writePerMin: 10,  readPerMin: 120, note: "Ledger writes are batch-coalesced internally" },
  { module: "QMaskCard",  writePerMin: 20,  readPerMin: 100, note: "Mask issuance is rate-limited independently from charge" },
  { module: "QGood",      writePerMin: 10,  readPerMin: 150, note: "Donation writes share bucket with campaign mutations" },
  { module: "Z-Tide",     writePerMin: 60,  readPerMin: 300, note: "Event submissions are high-throughput; reads are public" },
  { module: "QChainGov",  writePerMin: 5,   readPerMin: 100, note: "Proposal creation is strictly rate-limited per user" },
];

const HEADERS_TABLE = [
  { header: "X-RateLimit-Limit",     desc: "Requests per minute allowed for your tier" },
  { header: "X-RateLimit-Remaining", desc: "Requests left in the current window" },
  { header: "X-RateLimit-Reset",     desc: "Unix timestamp when the window resets" },
  { header: "Retry-After",           desc: "Seconds to wait before retrying (only on 429)" },
];

export default function FintechRateLimitsPage() {
  return (
    <main style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "3rem 1.5rem 4rem" }}>
        <Link href="/developers/fintech" style={{ color: C.muted, fontSize: "0.8rem", textDecoration: "none", display: "inline-block", marginBottom: 16 }}>← Fintech Docs</Link>
        <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "#f1f5f9", margin: 0 }}>Rate Limits</h1>
        <p style={{ color: C.muted, fontSize: "0.9rem", marginTop: 8 }}>
          All AEVION fintech APIs are rate-limited per API key. Limits reset on a rolling 60-second window.
        </p>

        {/* Tier table */}
        <section style={{ marginTop: 36 }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#f1f5f9", marginBottom: 14 }}>Limits by tier</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {["Tier", "Price", "Req/min", "Req/month", "Burst", "Concurrency"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", fontSize: "0.72rem" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TIERS.map((t, i) => (
                  <tr key={t.name} style={{ borderBottom: `1px solid ${C.border}30`, background: i % 2 === 0 ? "transparent" : `${C.surface}60` }}>
                    <td style={{ padding: "9px 12px", fontWeight: 700, color: "#f1f5f9" }}>{t.name}</td>
                    <td style={{ padding: "9px 12px", color: C.muted }}>{t.price}</td>
                    <td style={{ padding: "9px 12px", color: t.perMin ? C.green : C.accent, fontWeight: 600 }}>{t.perMin ? t.perMin.toLocaleString() : "Dedicated"}</td>
                    <td style={{ padding: "9px 12px", color: C.text }}>{t.perMonth}</td>
                    <td style={{ padding: "9px 12px", color: C.muted }}>{t.burst ? t.burst.toLocaleString() : "Negotiated"}</td>
                    <td style={{ padding: "9px 12px", color: C.muted }}>{t.concurrency ?? "Negotiated"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Per-module write limits */}
        <section style={{ marginTop: 36 }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#f1f5f9", marginBottom: 14 }}>Per-module limits (Scale tier basis)</h2>
          <p style={{ color: C.muted, fontSize: "0.83rem", marginBottom: 14 }}>
            The global rate limit applies first. These are secondary per-module limits that apply on top of tier limits.
          </p>
          <div style={{ display: "grid", gap: 6 }}>
            {MODULE_LIMITS.map(m => (
              <div key={m.module} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#f1f5f9", width: 100, flexShrink: 0 }}>{m.module}</span>
                <div style={{ display: "flex", gap: 16 }}>
                  <span style={{ fontSize: "0.8rem", color: C.muted }}>Write: <strong style={{ color: C.amber }}>{m.writePerMin}/min</strong></span>
                  <span style={{ fontSize: "0.8rem", color: C.muted }}>Read: <strong style={{ color: C.green }}>{m.readPerMin}/min</strong></span>
                </div>
                <span style={{ fontSize: "0.75rem", color: C.muted, flex: 1 }}>{m.note}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Response headers */}
        <section style={{ marginTop: 36 }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#f1f5f9", marginBottom: 14 }}>Rate limit headers</h2>
          <div style={{ display: "grid", gap: 6 }}>
            {HEADERS_TABLE.map(h => (
              <div key={h.header} style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
                <code style={{ background: C.code, padding: "3px 8px", borderRadius: 4, fontSize: "0.78rem", fontFamily: "ui-monospace, monospace", color: "#a5f3fc", flexShrink: 0 }}>{h.header}</code>
                <span style={{ fontSize: "0.82rem", color: C.muted }}>{h.desc}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Backoff recommendation */}
        <section style={{ marginTop: 36 }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#f1f5f9", marginBottom: 12 }}>Recommended backoff strategy</h2>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "1rem 1.25rem", fontSize: "0.82rem", color: C.muted, lineHeight: 1.7 }}>
            <p style={{ marginBottom: 8 }}>On receiving HTTP 429:</p>
            <ol style={{ paddingLeft: 20, margin: 0 }}>
              <li>Read <code style={{ background: C.code, padding: "1px 6px", borderRadius: 4, fontSize: "0.75rem" }}>Retry-After</code> header (seconds).</li>
              <li>Wait <code style={{ background: C.code, padding: "1px 6px", borderRadius: 4, fontSize: "0.75rem" }}>Retry-After + jitter(0–2s)</code>.</li>
              <li>Retry up to 3 times with exponential backoff: 1s, 2s, 4s.</li>
              <li>After 3 failures: queue for deferred retry (not synchronous user flow).</li>
            </ol>
            <p style={{ marginTop: 10 }}>The SDK handles this automatically — set <code style={{ background: C.code, padding: "1px 6px", borderRadius: 4, fontSize: "0.75rem" }}>{`{ retries: 3 }`}</code> in the client constructor.</p>
          </div>
        </section>

        <div style={{ marginTop: 36, display: "flex", gap: 20, fontSize: "0.8rem" }}>
          <Link href="/fintech/compare" style={{ color: C.accent, textDecoration: "none" }}>Upgrade tier →</Link>
          <Link href="/developers/fintech/errors" style={{ color: C.accent, textDecoration: "none" }}>Error codes →</Link>
          <Link href="/developers/fintech/sdk" style={{ color: C.accent, textDecoration: "none" }}>SDK reference →</Link>
        </div>
      </div>
    </main>
  );
}
