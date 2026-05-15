import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "AEVION Fintech — API Migration Guide",
  description: "Upgrade guide for AEVION fintech API versions. Breaking changes, deprecation timeline, and migration steps.",
  alternates: { canonical: "https://aevion.app/developers/fintech/migration" },
};

const C = { bg: "#050810", surface: "#0d1117", border: "#1e2a3a", text: "#e2e8f0", muted: "#64748b", code: "#0f1923", green: "#10b981", amber: "#f59e0b", red: "#ef4444", accent: "#6366f1" };

const VERSIONS = [
  {
    version: "v2.0",
    date: "2026-05-08",
    status: "current",
    breaking: [
      { area: "QPayNet wallets", change: "Amounts now stored in tiin (KZT ×100) — divide all balance fields by 100", example: "balance: 500000 → 5000.00 KZT" },
      { area: "QPayNet transfers", change: "fee is now returned in tiin, not percentage string", example: "fee: '0.1%' → fee: 50 (tiin)" },
      { area: "QChainGov proposals", change: "proposalType enum renamed: 'TEXT' → 'text', 'PARAM_CHANGE' → 'param_change'", example: "" },
    ],
    added: [
      "QPayNet payment requests (POST /api/qpaynet/requests)",
      "QPayNet webhook subscriptions per event type",
      "Z-Tide custom weight overrides per event type",
      "VeilNetX ledger stats endpoint",
      "GET /api/quotas — machine-readable tier matrix",
    ],
    deprecated: [],
  },
  {
    version: "v1.5",
    date: "2026-04-15",
    status: "maintained",
    breaking: [],
    added: [
      "QPayNet merchant API keys (X-Api-Key header)",
      "QGood donor analytics",
      "Z-Tide rank promotion webhooks",
    ],
    deprecated: [
      { field: "QPayNet /balance (GET)", replacement: "Use GET /api/qpaynet/wallets/:id instead", removedIn: "v2.1" },
    ],
  },
  {
    version: "v1.0",
    date: "2026-03-01",
    status: "deprecated",
    breaking: [],
    added: [],
    deprecated: [
      { field: "All v1.0 QPayNet endpoints at /api/payments/*", replacement: "/api/qpaynet/*", removedIn: "v2.0 (removed)" },
    ],
  },
];

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  current:    { bg: "#10b98120", color: "#34d399", label: "Current" },
  maintained: { bg: "#f59e0b20", color: "#fbbf24", label: "Maintained" },
  deprecated: { bg: "#64748b20", color: "#94a3b8", label: "Deprecated" },
};

function CodeBlock({ children }: { children: string }) {
  return (
    <code style={{ background: C.code, padding: "2px 8px", borderRadius: 4, fontSize: "0.78rem", fontFamily: "ui-monospace, monospace", color: "#a5f3fc" }}>
      {children}
    </code>
  );
}

export default function FintechMigrationPage() {
  return (
    <main style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "3rem 1.5rem 4rem" }}>
        <Link href="/developers/fintech" style={{ color: C.muted, fontSize: "0.8rem", textDecoration: "none", display: "inline-block", marginBottom: 16 }}>← Fintech Docs</Link>
        <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "#f1f5f9", margin: 0 }}>Migration Guide</h1>
        <p style={{ color: C.muted, fontSize: "0.9rem", marginTop: 8 }}>
          Breaking changes, deprecations, and upgrade steps for AEVION fintech APIs.
        </p>

        {/* Version selector */}
        <div style={{ display: "flex", gap: 8, marginTop: 28, marginBottom: 36, flexWrap: "wrap" }}>
          {VERSIONS.map(v => {
            const s = STATUS_STYLE[v.status];
            return (
              <a key={v.version} href={`#${v.version}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface, textDecoration: "none" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: C.text }}>{v.version}</span>
                <span style={{ fontSize: "0.7rem", fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: s.bg, color: s.color }}>{s.label}</span>
                <span style={{ fontSize: "0.75rem", color: C.muted }}>{v.date}</span>
              </a>
            );
          })}
        </div>

        {VERSIONS.map(v => {
          const s = STATUS_STYLE[v.status];
          return (
            <section key={v.version} id={v.version} style={{ marginBottom: 48 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, paddingBottom: 12, borderBottom: `1px solid ${C.border}` }}>
                <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#f1f5f9", margin: 0 }}>{v.version}</h2>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: s.bg, color: s.color }}>{s.label}</span>
                <span style={{ fontSize: "0.8rem", color: C.muted }}>{v.date}</span>
              </div>

              {/* Breaking changes */}
              {v.breaking.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <h3 style={{ fontSize: "0.85rem", fontWeight: 700, color: C.red, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>⚠ Breaking changes</h3>
                  <div style={{ display: "grid", gap: 8 }}>
                    {v.breaking.map((b, i) => (
                      <div key={i} style={{ background: "#ef444410", border: `1px solid ${C.red}30`, borderRadius: 8, padding: "12px 16px" }}>
                        <p style={{ fontSize: "0.82rem", fontWeight: 700, color: "#fca5a5", margin: 0, marginBottom: 4 }}>{b.area}</p>
                        <p style={{ fontSize: "0.8rem", color: C.muted, margin: 0, marginBottom: b.example ? 6 : 0 }}>{b.change}</p>
                        {b.example && <CodeBlock>{b.example}</CodeBlock>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Added */}
              {v.added.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <h3 style={{ fontSize: "0.85rem", fontWeight: 700, color: C.green, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>✓ New features</h3>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 4 }}>
                    {v.added.map((a, i) => (
                      <li key={i} style={{ fontSize: "0.82rem", color: C.muted, display: "flex", gap: 8 }}>
                        <span style={{ color: C.green }}>+</span>{a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Deprecated */}
              {v.deprecated.length > 0 && (
                <div>
                  <h3 style={{ fontSize: "0.85rem", fontWeight: 700, color: C.amber, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>⊘ Deprecated</h3>
                  <div style={{ display: "grid", gap: 8 }}>
                    {v.deprecated.map((d, i) => (
                      <div key={i} style={{ background: "#f59e0b10", border: `1px solid ${C.amber}30`, borderRadius: 8, padding: "10px 14px" }}>
                        <p style={{ fontSize: "0.82rem", fontWeight: 700, color: "#fde68a", margin: 0, marginBottom: 3 }}>{d.field}</p>
                        <p style={{ fontSize: "0.8rem", color: C.muted, margin: 0, marginBottom: 3 }}>Use: {d.replacement}</p>
                        <p style={{ fontSize: "0.75rem", color: C.amber, margin: 0 }}>Removed in: {d.removedIn}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {v.breaking.length === 0 && v.added.length === 0 && v.deprecated.length === 0 && (
                <p style={{ color: C.muted, fontSize: "0.85rem" }}>No significant changes documented for this version.</p>
              )}
            </section>
          );
        })}

        <div style={{ marginTop: 32, display: "flex", gap: 20, fontSize: "0.8rem", color: C.muted }}>
          <Link href="/developers/fintech/errors" style={{ color: C.accent, textDecoration: "none" }}>Error codes →</Link>
          <Link href="/developers/fintech/sdk" style={{ color: C.accent, textDecoration: "none" }}>SDK reference →</Link>
          <Link href="/changelog" style={{ color: C.accent, textDecoration: "none" }}>Full changelog →</Link>
        </div>
      </div>
    </main>
  );
}
