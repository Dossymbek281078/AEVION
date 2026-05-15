import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "AEVION Fintech API Changelog",
  description: "Release history for AEVION fintech APIs: QPayNet, VeilNetX, QMaskCard, QGood, Z-Tide, QChainGov.",
  alternates: { canonical: "https://aevion.app/developers/fintech/changelog" },
};

const C = { bg: "#050810", surface: "#0d1117", border: "#1e2a3a", text: "#e2e8f0", muted: "#64748b", green: "#10b981", amber: "#f59e0b", blue: "#6366f1" };

const ENTRIES = [
  {
    version: "2.1.0",
    date: "2026-05-12",
    tag: "latest",
    changes: [
      { type: "added",   text: "QPayNet payment requests — shareable pay links with expiry + max-view limits" },
      { type: "added",   text: "QPayNet webhook subscriptions per event type (transfer.completed, request.paid, …)" },
      { type: "added",   text: "Z-Tide custom weight overrides per contribution event type" },
      { type: "added",   text: "VeilNetX ledger stats endpoint (GET /api/veilnetx/ledger/stats)" },
      { type: "added",   text: "GET /api/quotas — machine-readable tier matrix (4 tiers, 7 endpoint surfaces)" },
      { type: "added",   text: "QPayNet admin dashboard: reconcile, freeze, bulk-refund, webhook deliveries" },
      { type: "fixed",   text: "QPayNet: Stripe webhook signature verification was broken — now uses raw-body HMAC" },
      { type: "fixed",   text: "QMaskCard: isAdmin guard now fail-closed in production (was open when env unset)" },
    ],
  },
  {
    version: "2.0.0",
    date: "2026-05-08",
    tag: "stable",
    breaking: true,
    changes: [
      { type: "breaking", text: "QPayNet amounts now in tiin (KZT ×100) — divide balance fields by 100" },
      { type: "breaking", text: "QPayNet fee returned as integer tiin, not percentage string" },
      { type: "breaking", text: "QChainGov proposalType enum lowercased: TEXT→text, PARAM_CHANGE→param_change" },
      { type: "added",   text: "QPayNet merchant API keys (X-Api-Key header auth)" },
      { type: "added",   text: "QGood donor analytics endpoint" },
      { type: "added",   text: "Z-Tide rank promotion webhooks" },
      { type: "added",   text: "All modules: health + stats endpoints standardised" },
    ],
  },
  {
    version: "1.5.0",
    date: "2026-04-28",
    tag: "maintained",
    changes: [
      { type: "added",   text: "VeilNetX: settlement ledger with hash-linked entries" },
      { type: "added",   text: "QChainGov: proposal creation + AEV-weighted voting" },
      { type: "added",   text: "Z-Tide: leaderboard + contribution events API" },
      { type: "added",   text: "QGood: charity campaigns with AEC mint bonus on donation" },
      { type: "fixed",   text: "QMaskCard: virtual card expiry validation" },
    ],
  },
  {
    version: "1.0.0",
    date: "2026-04-01",
    tag: "deprecated",
    changes: [
      { type: "added",   text: "QPayNet v1: KZT wallets, P2P transfers, basic deposit" },
      { type: "added",   text: "QMaskCard v1: virtual card issuance" },
      { type: "note",    text: "All /api/payments/* endpoints — migrated to /api/qpaynet/* in v2.0" },
    ],
  },
];

const TYPE_STYLE: Record<string, { color: string; prefix: string }> = {
  added:    { color: "#10b981", prefix: "+" },
  fixed:    { color: "#6366f1", prefix: "✓" },
  breaking: { color: "#ef4444", prefix: "⚠" },
  deprecated:{ color: "#f59e0b", prefix: "−" },
  note:     { color: "#64748b", prefix: "·" },
};

const TAG_STYLE: Record<string, { bg: string; color: string }> = {
  latest:     { bg: "#10b98120", color: "#34d399" },
  stable:     { bg: "#6366f120", color: "#a5b4fc" },
  maintained: { bg: "#f59e0b20", color: "#fde68a" },
  deprecated: { bg: "#64748b20", color: "#94a3b8" },
};

export default function FintechChangelogPage() {
  return (
    <main style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "3rem 1.5rem 4rem" }}>
        <Link href="/developers/fintech" style={{ color: C.muted, fontSize: "0.8rem", textDecoration: "none", display: "inline-block", marginBottom: 12 }}>← Fintech Docs</Link>
        <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "#f1f5f9", margin: 0 }}>API Changelog</h1>
        <p style={{ color: C.muted, fontSize: "0.9rem", marginTop: 8 }}>
          All notable changes to the AEVION fintech APIs. Follows semantic versioning — breaking changes only in major versions.
        </p>

        <div style={{ marginTop: 36, display: "grid", gap: 28 }}>
          {ENTRIES.map(entry => {
            const tagStyle = TAG_STYLE[entry.tag] ?? TAG_STYLE.maintained;
            return (
              <div key={entry.version} id={`v${entry.version}`}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${C.border}` }}>
                  <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#f1f5f9", margin: 0 }}>v{entry.version}</h2>
                  <span style={{ fontSize: "0.7rem", fontWeight: 700, padding: "2px 10px", borderRadius: 999, background: tagStyle.bg, color: tagStyle.color, textTransform: "uppercase" }}>
                    {entry.tag}
                  </span>
                  {entry.breaking && (
                    <span style={{ fontSize: "0.7rem", fontWeight: 700, padding: "2px 10px", borderRadius: 999, background: "#ef444420", color: "#fca5a5", textTransform: "uppercase" }}>
                      Breaking
                    </span>
                  )}
                  <span style={{ fontSize: "0.78rem", color: C.muted, marginLeft: "auto" }}>{entry.date}</span>
                </div>
                <div style={{ display: "grid", gap: 5 }}>
                  {entry.changes.map((c, i) => {
                    const ts = TYPE_STYLE[c.type] ?? TYPE_STYLE.note;
                    return (
                      <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <span style={{ fontSize: "0.8rem", fontWeight: 700, color: ts.color, flexShrink: 0, width: 14 }}>{ts.prefix}</span>
                        <span style={{ fontSize: "0.83rem", color: c.type === "breaking" ? "#fca5a5" : C.muted, lineHeight: 1.5 }}>{c.text}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 36, padding: "14px 18px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: "0.82rem", color: C.muted, lineHeight: 1.7 }}>
          <strong style={{ color: C.text }}>Upgrade guide:</strong>{" "}
          <Link href="/developers/fintech/migration" style={{ color: C.blue, textDecoration: "none" }}>v1 → v2 migration →</Link>
          {" · "}
          <Link href="/developers/fintech/errors" style={{ color: C.blue, textDecoration: "none" }}>Error codes →</Link>
          {" · "}
          <Link href="/developers/fintech/rate-limits" style={{ color: C.blue, textDecoration: "none" }}>Rate limits →</Link>
        </div>
      </div>
    </main>
  );
}
