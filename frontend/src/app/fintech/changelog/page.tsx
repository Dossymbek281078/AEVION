import type { Metadata } from "next";
import Link from "next/link";
import FintechFooter from "@/components/fintech/FintechFooter";

// Zone: aevion-core/main owns frontend/src/app/fintech/**

export const metadata: Metadata = {
  title: "AEVION Fintech Changelog — release history across 5 modules",
  description:
    "Public changelog for AEVION fintech: VeilNetX, QGood, QMaskCard, Z-Tide, QChainGov. Major features, bug fixes, breaking changes per release.",
  alternates: { canonical: "https://aevion.app/fintech/changelog" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "AEVION Fintech Changelog",
    description: "Release history for all 5 fintech modules.",
    type: "article",
    url: "https://aevion.app/fintech/changelog",
  },
};

const C = {
  bg: "#0f172a", panel: "#1e293b", border: "#334155",
  text: "#f1f5f9", dim: "#94a3b8", faint: "#64748b",
  accent: "#a78bfa", green: "#34d399", yellow: "#fbbf24",
};

type Entry = {
  date: string;
  module: string;
  moduleColor: string;
  type: "feat" | "fix" | "chore" | "docs";
  title: string;
  description?: string;
};

const ENTRIES: Entry[] = [
  { date: "2026-05-12", module: "Fintech", moduleColor: "#a78bfa", type: "feat", title: "Cross-module integration smoke + stats aggregator",
    description: "Two new ops scripts: 7-step health audit and live stats CLI. Registered in all-smokes registry." },
  { date: "2026-05-12", module: "Fintech", moduleColor: "#a78bfa", type: "feat", title: "Whitepaper + dashboard + quickstart pages",
    description: "Three new public pages: architecture whitepaper, live cross-module dashboard, and 6-curl quickstart." },
  { date: "2026-05-12", module: "QChainGov", moduleColor: "#f472b6", type: "feat", title: "Proposal /execute admin endpoint",
    description: "Tally-based pass/reject flip with audit trail. Admin-only gated." },
  { date: "2026-05-12", module: "VeilNetX", moduleColor: "#a78bfa", type: "feat", title: "GET /search — public hash-prefix lookup",
    description: "Search entries by entryHash or prevHash prefix. Read-only and unauthenticated." },
  { date: "2026-05-12", module: "Z-Tide", moduleColor: "#fbbf24", type: "feat", title: "Login-streak self-claim",
    description: "20-hour cooldown gate. Awards Z-Tide kind=login-streak +1 on claim." },
  { date: "2026-05-12", module: "QMaskCard", moduleColor: "#c4b5fd", type: "feat", title: "Charge detail page with risk-score gauge",
    description: "Per-charge AI fraud-scoring visualization with decline-reason humanizer." },
  { date: "2026-05-11", module: "Fintech", moduleColor: "#a78bfa", type: "feat", title: "All 5 fintech modules in prod 200/200",
    description: "Matching fund, login-streak, ZTideRankPill, /fintech/status, prod-smoke 13/13. Backlog исчерпан." },
  { date: "2026-05-11", module: "QGood", moduleColor: "#34d399", type: "feat", title: "Matching pool admin panel",
    description: "Admin can configure platform-side matching multipliers per campaign." },
  { date: "2026-05-08", module: "QPayNet", moduleColor: "#06b6d4", type: "feat", title: "Mobile responsiveness pass",
    description: "Touch targets and header wrap fixed for mobile-first usage. Reaffirmed 21/21 prod smoke." },
  { date: "2026-05-08", module: "Fintech", moduleColor: "#a78bfa", type: "fix", title: "QTradeOffline mount + Awards health/stats",
    description: "Backend route mount restored. Security hardening CI fix." },
  { date: "2026-05-04", module: "QPayNet", moduleColor: "#06b6d4", type: "feat", title: "~30 commits — 99.5% prod-ready",
    description: "Stripe deposit + payouts + notifications + KYC + webhooks retry + OG + widget + SMTP email." },
];

function TypeBadge({ type }: { type: Entry["type"] }) {
  const colors: Record<Entry["type"], { bg: string; fg: string; label: string }> = {
    feat:  { bg: "rgba(52,211,153,0.15)", fg: "#34d399", label: "FEAT" },
    fix:   { bg: "rgba(251,191,36,0.15)", fg: "#fbbf24", label: "FIX" },
    chore: { bg: "rgba(148,163,184,0.15)", fg: "#94a3b8", label: "CHORE" },
    docs:  { bg: "rgba(167,139,250,0.15)", fg: "#a78bfa", label: "DOCS" },
  };
  const c = colors[type];
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 6px",
      borderRadius: 4,
      background: c.bg,
      color: c.fg,
      fontSize: 9,
      fontWeight: 900,
      letterSpacing: 0.4,
      fontFamily: "ui-monospace, monospace",
    }}>{c.label}</span>
  );
}

export default function FintechChangelogPage() {
  // Group by date
  const grouped = ENTRIES.reduce<Record<string, Entry[]>>((acc, e) => {
    if (!acc[e.date]) acc[e.date] = [];
    acc[e.date].push(e);
    return acc;
  }, {});
  const dates = Object.keys(grouped).sort().reverse();

  return (
    <main style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "system-ui, sans-serif", padding: "32px 16px" }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        {/* Breadcrumb */}
        <div style={{ fontSize: 12, color: C.faint, marginBottom: 16 }}>
          <Link href="/fintech" style={{ color: C.dim, textDecoration: "none" }}>Fintech</Link>
          {" / "}<span style={{ color: C.text }}>Changelog</span>
        </div>

        <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.02em", margin: "0 0 8px" }}>
          Fintech Changelog
        </h1>
        <p style={{ fontSize: 14, color: C.dim, margin: "0 0 32px", lineHeight: 1.6 }}>
          Release history for the 5 AEVION fintech modules. Grouped by date, newest first.
        </p>

        {/* Timeline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {dates.map((date) => (
            <section key={date}>
              <div style={{
                fontSize: 11,
                fontWeight: 900,
                color: C.accent,
                letterSpacing: 0.6,
                textTransform: "uppercase",
                marginBottom: 10,
                paddingBottom: 6,
                borderBottom: `1px solid ${C.border}`,
              }}>
                {date}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {grouped[date].map((e, i) => (
                  <div key={i} style={{
                    padding: "12px 16px",
                    background: C.panel,
                    borderRadius: 10,
                    border: `1px solid ${C.border}`,
                    borderLeft: `3px solid ${e.moduleColor}`,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <TypeBadge type={e.type} />
                      <span style={{
                        fontSize: 10,
                        fontWeight: 800,
                        color: e.moduleColor,
                        letterSpacing: 0.4,
                        textTransform: "uppercase",
                      }}>{e.module}</span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4 }}>
                      {e.title}
                    </div>
                    {e.description && (
                      <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.5 }}>
                        {e.description}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* GitHub link */}
        <div style={{ marginTop: 32, padding: "12px 16px", background: C.panel, borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 12, color: C.dim, textAlign: "center" }}>
          Full commit history:{" "}
          <a href="https://github.com/Dossymbek281078/AEVION/commits/main" style={{ color: C.accent, textDecoration: "none" }}>
            github.com/Dossymbek281078/AEVION →
          </a>
        </div>

        <FintechFooter />
      </div>
    </main>
  );
}
