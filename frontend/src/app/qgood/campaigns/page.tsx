import type { Metadata } from "next";
import Link from "next/link";
import { getApiBase } from "@/lib/apiBase";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "QGood Campaigns — Transparent Charity · AEVION",
  description:
    "Прозрачные благотворительные кампании на AEVION. Каждый донат — audit-trail через QRight + VeilNetX ledger. Stripe-готовый платёжный канал.",
  alternates: { canonical: "https://aevion.app/qgood/campaigns" },
  openGraph: {
    type: "website",
    url: "https://aevion.app/qgood/campaigns",
    title: "QGood Campaigns — Charity that's transparent by default",
    description: "Запусти кампанию или поддержи. Все донаты на audit-цепочке.",
    siteName: "AEVION",
  },
  robots: { index: true, follow: true },
};

type Campaign = {
  id: string;
  title: string;
  description: string;
  category: string;
  country: string | null;
  targetCents: string | number;
  raisedCents: string | number;
  donorCount: number;
  currency: string;
  status: string;
  imageUrl: string | null;
  createdAt: string;
};

type Stats = {
  total_campaigns: number;
  active_campaigns: number;
  total_raised_cents: string | number;
  total_donors: number;
};

async function loadCampaigns(): Promise<Campaign[]> {
  try {
    const r = await fetch(`${getApiBase()}/api/qgood/campaigns?status=active&limit=12`, {
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return [];
    const data = await r.json();
    return Array.isArray(data?.campaigns) ? data.campaigns : [];
  } catch { return []; }
}

async function loadStats(): Promise<Stats | null> {
  try {
    const r = await fetch(`${getApiBase()}/api/qgood/stats`, {
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

function fmtMoney(cents: string | number, currency = "USD"): string {
  const n = typeof cents === "string" ? parseInt(cents, 10) : cents;
  if (!Number.isFinite(n)) return "$0";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n / 100);
}

function progressPct(raised: string | number, target: string | number): number {
  const r = typeof raised === "string" ? parseInt(raised, 10) : raised;
  const t = typeof target === "string" ? parseInt(target, 10) : target;
  if (!Number.isFinite(t) || t <= 0) return 0;
  return Math.min(100, Math.round((r / t) * 100));
}

export default async function QGoodCampaignsPage() {
  const [campaigns, stats] = await Promise.all([loadCampaigns(), loadStats()]);

  return (
    <main style={{ minHeight: "100vh", background: "#0f172a", color: "#f1f5f9" }}>
      <section style={{ padding: "48px 24px 24px", textAlign: "center" }}>
        <div style={{ maxWidth: 880, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 12 }}>
            <Link href="/qgood" style={{ fontSize: 12, color: "#94a3b8", textDecoration: "none" }}>← QGood</Link>
          </div>
          <div style={{ display: "inline-block", padding: "4px 12px", background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.4)", borderRadius: 999, fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", color: "#6ee7b7", marginBottom: 16 }}>QGOOD · CHARITY MVP</div>
          <h1 style={{ fontSize: 40, fontWeight: 900, margin: 0, lineHeight: 1.1, marginBottom: 12 }}>
            Charity that's <span style={{ color: "#34d399" }}>transparent by default</span>
          </h1>
          <p style={{ fontSize: 16, lineHeight: 1.55, color: "#94a3b8", maxWidth: 620, margin: "0 auto 20px" }}>
            Запусти кампанию или поддержи. Audit-trail через QRight + VeilNetX ledger. Stripe-готовый платёжный канал.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="#campaigns" style={{ padding: "10px 20px", background: "#10b981", color: "#062e22", fontWeight: 800, fontSize: 13, borderRadius: 10, textDecoration: "none" }}>View campaigns</a>
            <Link href="/auth?next=/qgood/campaigns/new" style={{ padding: "10px 20px", background: "transparent", color: "#f1f5f9", fontWeight: 800, fontSize: 13, borderRadius: 10, textDecoration: "none", border: "1px solid #475569" }}>Start a campaign</Link>
          </div>
        </div>
      </section>

      {stats && (
        <section style={{ padding: "0 24px 24px" }}>
          <div style={{ maxWidth: 880, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(150px, 100%), 1fr))", gap: 10 }}>
            <Stat label="Active campaigns" value={String(stats.active_campaigns)} />
            <Stat label="Total raised" value={fmtMoney(stats.total_raised_cents)} />
            <Stat label="Total donors" value={String(stats.total_donors)} />
            <Stat label="All campaigns" value={String(stats.total_campaigns)} />
          </div>
        </section>
      )}

      <section id="campaigns" style={{ padding: "24px 24px 64px" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>Active campaigns</h2>
          {campaigns.length === 0 ? (
            <div style={{ padding: 28, textAlign: "center", background: "#1e293b", border: "1px dashed #334155", borderRadius: 12, color: "#94a3b8" }}>
              No active campaigns yet. <Link href="/auth?next=/qgood/campaigns/new" style={{ color: "#34d399" }}>Be the first</Link>.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(280px, 100%), 1fr))", gap: 14 }}>
              {campaigns.map((c) => (
                <CampaignCard key={c.id} c={c} />
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: 14, background: "#1e293b", border: "1px solid #334155", borderRadius: 10, textAlign: "center" }}>
      <div style={{ fontSize: 20, fontWeight: 900, color: "#34d399" }}>{value}</div>
      <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: "0.05em", textTransform: "uppercase" as const, marginTop: 4 }}>{label}</div>
    </div>
  );
}

function CampaignCard({ c }: { c: Campaign }) {
  const pct = progressPct(c.raisedCents, c.targetCents);
  return (
    <Link href={`/qgood/campaigns/${c.id}`} style={{ display: "block", padding: 14, background: "#1e293b", border: "1px solid #334155", borderRadius: 12, textDecoration: "none", color: "#f1f5f9" }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 6 }}>
        {c.category}{c.country ? " · " + c.country : ""}
      </div>
      <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, marginBottom: 6, lineHeight: 1.3 }}>{c.title}</h3>
      <p style={{ fontSize: 12, color: "#94a3b8", margin: 0, marginBottom: 10, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {c.description}
      </p>
      <div style={{ height: 5, background: "#0f172a", borderRadius: 999, overflow: "hidden", marginBottom: 6 }}>
        <div style={{ height: "100%", width: `${pct}%`, background: "#10b981" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8" }}>
        <span style={{ color: "#34d399", fontWeight: 700 }}>{fmtMoney(c.raisedCents, c.currency)} raised</span>
        <span>{c.donorCount} donor{c.donorCount === 1 ? "" : "s"}</span>
      </div>
      <div style={{ fontSize: 10, color: "#64748b", marginTop: 3 }}>of {fmtMoney(c.targetCents, c.currency)} · {pct}%</div>
    </Link>
  );
}
