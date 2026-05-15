import type { Metadata } from "next";
import FintechLiveStats from "@/components/fintech/FintechLiveStats";
import FintechHealthBadge from "@/components/fintech/FintechHealthBadge";
import FintechModuleCard from "@/components/fintech/FintechModuleCard";
import FintechFooter from "@/components/fintech/FintechFooter";
import FintechMetric from "@/components/fintech/FintechMetric";
import Link from "next/link";

// Zone: aevion-core/main owns frontend/src/app/fintech/**

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "AEVION Fintech Dashboard — live cross-module overview",
  description:
    "Live dashboard for the 5 AEVION fintech modules: VeilNetX chain length, QGood donations raised, active campaigns, QChainGov proposals, Z-Tide top contributors. Updated every 30 seconds.",
  alternates: { canonical: "https://aevion.app/fintech/dashboard" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "AEVION Fintech Dashboard",
    description: "Live cross-module metrics — VeilNetX, QGood, QMaskCard, Z-Tide, QChainGov.",
    type: "website",
    url: "https://aevion.app/fintech/dashboard",
  },
};

const MODULES = [
  {
    emoji: "🌀",
    name: "VeilNetX",
    tagline: "Settlement ledger",
    description: "Append-only hash-chained ledger. Every donation, mask, transfer is recorded.",
    accent: "#a78bfa",
    cta: { href: "/veilnetx/ledger", label: "View chain →" },
  },
  {
    emoji: "💚",
    name: "QGood",
    tagline: "Transparent charity",
    description: "Donations with on-chain verification. Every contribution is auditable.",
    accent: "#34d399",
    cta: { href: "/qgood/campaigns", label: "Browse campaigns →" },
  },
  {
    emoji: "🪪",
    name: "QMaskCard",
    tagline: "Payment masking",
    description: "Single-use virtual PANs. Real funding source stays private.",
    accent: "#c4b5fd",
    cta: { href: "/qmaskcard/dashboard", label: "Open masks →" },
  },
  {
    emoji: "🌊",
    name: "Z-Tide",
    tagline: "Reputation layer",
    description: "Soft, decaying reputation from contributions across all modules.",
    accent: "#fbbf24",
    cta: { href: "/z-tide/leaderboard", label: "Leaderboard →" },
  },
  {
    emoji: "🗳",
    name: "QChainGov",
    tagline: "Governance",
    description: "On-chain proposals + voting. Tally drives execution.",
    accent: "#f472b6",
    cta: { href: "/qchaingov/proposals", label: "Active proposals →" },
  },
];

export default function FintechDashboardPage() {
  return (
    <main style={{
      background: "#0f172a",
      minHeight: "100vh",
      color: "#f1f5f9",
      fontFamily: "system-ui, -apple-system, sans-serif",
      padding: "32px 16px",
    }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>
              <Link href="/fintech" style={{ color: "#94a3b8", textDecoration: "none" }}>Fintech</Link>
              {" / "}<span style={{ color: "#f1f5f9" }}>Dashboard</span>
            </div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, letterSpacing: "-0.02em" }}>
              Fintech Dashboard
            </h1>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "#94a3b8" }}>
              Live cross-module metrics. Updated every 30 seconds.
            </p>
          </div>
          <FintechHealthBadge />
        </div>

        {/* Live stats */}
        <section style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 12 }}>
            Real-time metrics
          </div>
          <FintechLiveStats />
        </section>

        {/* Per-module metric tiles with sparklines */}
        <section style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 12 }}>
            Module pulse (1 min poll · sparklines)
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <FintechMetric label="VeilNetX chain"     icon="🌀" accent="#a78bfa" apiPath="/api/veilnetx-ledger/head"  valuePath="length"             pollSeconds={60} />
            <FintechMetric label="QGood raised (¢)"   icon="💚" accent="#34d399" apiPath="/api/qgood/stats"           valuePath="total_raised_cents" pollSeconds={60} />
            <FintechMetric label="Z-Tide users"       icon="🌊" accent="#fbbf24" apiPath="/api/ztide/stats"           valuePath="active_users"       pollSeconds={60} />
            <FintechMetric label="QChain proposals"   icon="🗳" accent="#f472b6" apiPath="/api/qchaingov/stats"       valuePath="open_proposals"     pollSeconds={60} />
          </div>
        </section>

        {/* Modules grid */}
        <section>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 12 }}>
            Modules
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 16,
          }}>
            {MODULES.map((m) => (
              <FintechModuleCard
                key={m.name}
                emoji={m.emoji}
                name={m.name}
                tagline={m.tagline}
                description={m.description}
                accent={m.accent}
                cta={m.cta}
                size="md"
              />
            ))}
          </div>
        </section>

        <FintechFooter hideHealthBadge />
      </div>
    </main>
  );
}
