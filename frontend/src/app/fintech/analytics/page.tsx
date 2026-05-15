import type { Metadata } from "next";
import Link from "next/link";
import { getApiBase } from "@/lib/apiBase";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AEVION Fintech Analytics — live ecosystem metrics",
  description: "Real-time analytics across all 6 AEVION fintech modules: payment volumes, wallet counts, reputation scores, governance participation.",
  alternates: { canonical: "https://aevion.app/fintech/analytics" },
};

// ── Types ──────────────────────────────────────────────────────────────────────

type QPayStats = {
  activeWallets?: number;
  totalWallets?: number;
  totalTransactions?: number;
  totalDepositedKzt?: number;
  totalVolumeKzt?: number;
};

type ZTideStats = {
  active_users?: number;
  total_events?: number;
  total_weight?: number | string;
  top_score?: number | string | null;
};

type QChainStats = {
  total_proposals?: number;
  open_proposals?: number;
  total_votes?: number;
  unique_voters?: number;
};

type QGoodStats = {
  total_campaigns?: number;
  active_campaigns?: number;
  total_raised_cents?: number;
  total_donors?: number;
};

// ── Loaders ───────────────────────────────────────────────────────────────────

async function load<T>(path: string): Promise<T | null> {
  try {
    const r = await fetch(`${getApiBase()}${path}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtNum(n: number | string | undefined | null, unit = ""): string {
  const v = typeof n === "string" ? parseFloat(n) : n;
  if (v == null || isNaN(v as number)) return "—";
  const num = v as number;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M${unit}`;
  if (num >= 1_000)     return `${(num / 1_000).toFixed(1)}K${unit}`;
  return `${Math.round(num)}${unit}`;
}

function fmtKzt(kzt: number | undefined | null): string {
  if (kzt == null) return "—";
  if (kzt >= 1_000_000) return `${(kzt / 1_000_000).toFixed(2)}M ₸`;
  if (kzt >= 1_000)     return `${(kzt / 1_000).toFixed(1)}K ₸`;
  return `${kzt.toFixed(0)} ₸`;
}

// ── Style ─────────────────────────────────────────────────────────────────────

const C = {
  bg: "#050810",
  surface: "#0d1117",
  border: "#1e2a3a",
  text: "#e2e8f0",
  muted: "#64748b",
  pay: "#06b6d4",
  ztide: "#fbbf24",
  gov: "#f472b6",
  good: "#34d399",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${color}30`,
        borderRadius: 12,
        padding: "18px 20px",
      }}
    >
      <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: C.muted, margin: 0, marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: 28, fontWeight: 900, color, margin: 0, lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 12, color: C.muted, margin: 0, marginTop: 4 }}>{sub}</p>}
    </div>
  );
}

function ModuleSection({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 36 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{ width: 4, height: 20, background: accent, borderRadius: 2 }} />
        <h2 style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: 0 }}>{title}</h2>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
        {children}
      </div>
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function FintechAnalyticsPage() {
  const [qpay, ztide, qchain, qgood] = await Promise.all([
    load<QPayStats>("/api/qpaynet/stats"),
    load<ZTideStats>("/api/ztide/stats"),
    load<QChainStats>("/api/qchaingov/stats"),
    load<QGoodStats>("/api/qgood/stats"),
  ]);

  return (
    <main style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ padding: "3rem 1.5rem 2.5rem", maxWidth: 960, margin: "0 auto" }}>
        <Link href="/fintech" style={{ color: C.muted, fontSize: "0.8rem", textDecoration: "none", display: "inline-block", marginBottom: 12 }}>← Fintech Hub</Link>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "#f1f5f9", margin: 0 }}>Fintech Analytics</h1>
            <p style={{ color: C.muted, fontSize: "0.85rem", marginTop: 6 }}>Live metrics across all 6 AEVION fintech modules · refreshes on each page load</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Link href="/fintech/status" style={{ padding: "8px 14px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.muted, fontSize: "0.78rem", textDecoration: "none" }}>Live status →</Link>
            <Link href="/fintech/compare" style={{ padding: "8px 14px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.muted, fontSize: "0.78rem", textDecoration: "none" }}>Compare tiers →</Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 1.5rem 4rem" }}>

        {/* QPayNet */}
        <ModuleSection title="QPayNet — Wallet rails" accent={C.pay}>
          <StatCard label="Active wallets"      value={fmtNum(qpay?.activeWallets ?? qpay?.totalWallets)} color={C.pay} />
          <StatCard label="Total transactions"  value={fmtNum(qpay?.totalTransactions)} color={C.pay} />
          <StatCard label="Total deposited"     value={fmtKzt(qpay?.totalDepositedKzt)} color={C.pay} sub="KZT all-time" />
        </ModuleSection>

        {/* Z-Tide */}
        <ModuleSection title="Z-Tide — Reputation" accent={C.ztide}>
          <StatCard label="Active users"    value={fmtNum(ztide?.active_users)} color={C.ztide} />
          <StatCard label="Events recorded" value={fmtNum(ztide?.total_events)} color={C.ztide} />
          <StatCard label="Top score"       value={fmtNum(ztide?.top_score)} color={C.ztide} sub="highest individual" />
        </ModuleSection>

        {/* QChainGov */}
        <ModuleSection title="QChainGov — Governance" accent={C.gov}>
          <StatCard label="Total proposals" value={fmtNum(qchain?.total_proposals)} color={C.gov} />
          <StatCard label="Open proposals"  value={fmtNum(qchain?.open_proposals)} color={C.gov} sub="accepting votes" />
          <StatCard label="Unique voters"   value={fmtNum(qchain?.unique_voters)} color={C.gov} />
          <StatCard label="Total votes"     value={fmtNum(qchain?.total_votes)} color={C.gov} />
        </ModuleSection>

        {/* QGood */}
        <ModuleSection title="QGood — Charity" accent={C.good}>
          <StatCard label="Active campaigns" value={fmtNum(qgood?.active_campaigns)} color={C.good} />
          <StatCard label="Total raised"     value={fmtNum((qgood?.total_raised_cents ?? 0) / 100, " KZT")} color={C.good} />
          <StatCard label="Total donors"     value={fmtNum(qgood?.total_donors)} color={C.good} />
        </ModuleSection>

        {/* Footer links */}
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: "0.8rem", color: C.muted, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
          <Link href="/fintech/modules" style={{ color: "#6366f1", textDecoration: "none" }}>All 6 modules →</Link>
          <Link href="/fintech/integrations" style={{ color: "#6366f1", textDecoration: "none" }}>Integrations →</Link>
          <Link href="/developers/fintech" style={{ color: "#6366f1", textDecoration: "none" }}>API docs →</Link>
          <Link href="/qpaynet" style={{ color: "#6366f1", textDecoration: "none" }}>Open QPayNet →</Link>
        </div>
      </div>
    </main>
  );
}
