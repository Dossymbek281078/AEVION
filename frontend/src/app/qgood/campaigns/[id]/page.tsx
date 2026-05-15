import type { Metadata } from "next";
import Link from "next/link";
import { getApiBase } from "@/lib/apiBase";
import DonateForm from "./DonateForm";

export const dynamic = "force-dynamic";

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
  approvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
};

type Donation = {
  id: string;
  amountCents: string | number;
  currency: string;
  donorName: string | null;
  messageText: string | null;
  anonymous: boolean;
  createdAt: string;
};

type DetailResponse = {
  campaign: Campaign;
  donations: Donation[];
};

async function loadCampaign(id: string): Promise<DetailResponse | null> {
  try {
    const r = await fetch(`${getApiBase()}/api/qgood/campaigns/${encodeURIComponent(id)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (r.status === 404) return null;
    if (!r.ok) return null;
    const data = await r.json();
    if (!data || typeof data !== "object" || !data.campaign) return null;
    return {
      campaign: data.campaign as Campaign,
      donations: Array.isArray(data.donations) ? (data.donations as Donation[]) : [],
    };
  } catch {
    return null;
  }
}

function fmtMoney(cents: string | number, currency = "USD"): string {
  const n = typeof cents === "string" ? parseInt(cents, 10) : cents;
  if (!Number.isFinite(n)) return "$0";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n / 100);
  } catch {
    return `$${Math.round(n / 100)}`;
  }
}

function progressPct(raised: string | number, target: string | number): number {
  const r = typeof raised === "string" ? parseInt(raised, 10) : raised;
  const t = typeof target === "string" ? parseInt(target, 10) : target;
  if (!Number.isFinite(t) || t <= 0) return 0;
  if (!Number.isFinite(r) || r <= 0) return 0;
  return Math.min(100, Math.round((r / t) * 100));
}

function timeAgo(iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  const diffSec = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const m = Math.round(diffSec / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.round(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  const y = Math.round(mo / 12);
  return `${y}y ago`;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = await loadCampaign(id);
  if (!data) {
    return {
      title: "Campaign not found · QGood · AEVION",
      robots: { index: false, follow: false },
    };
  }
  const c = data.campaign;
  const desc = (c.description || "").slice(0, 180);
  return {
    title: `${c.title} · QGood · AEVION`,
    description: desc,
    alternates: { canonical: `https://aevion.app/qgood/campaigns/${c.id}` },
    openGraph: {
      type: "article",
      url: `https://aevion.app/qgood/campaigns/${c.id}`,
      title: c.title,
      description: desc,
      siteName: "AEVION",
      images: c.imageUrl ? [{ url: c.imageUrl }] : undefined,
    },
    robots: { index: c.status === "active", follow: true },
  };
}

export default async function QGoodCampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadCampaign(id);

  if (!data) {
    return (
      <main style={{ minHeight: "100vh", background: "#0f172a", color: "#f1f5f9", padding: "64px 24px" }}>
        <div style={{ maxWidth: 560, margin: "0 auto", textAlign: "center" }}>
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 16 }}>
            <Link href="/qgood/campaigns" style={{ color: "#94a3b8", textDecoration: "none" }}>← All campaigns</Link>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0, marginBottom: 12 }}>Campaign not found</h1>
          <p style={{ fontSize: 14, color: "#94a3b8", margin: 0, marginBottom: 24, lineHeight: 1.6 }}>
            The campaign you&apos;re looking for doesn&apos;t exist, was removed, or hasn&apos;t been approved yet.
          </p>
          <Link
            href="/qgood/campaigns"
            style={{ display: "inline-block", padding: "10px 20px", background: "#10b981", color: "#062e22", fontWeight: 800, fontSize: 13, borderRadius: 10, textDecoration: "none" }}
          >
            Browse active campaigns
          </Link>
        </div>
      </main>
    );
  }

  const { campaign: c, donations } = data;
  const pct = progressPct(c.raisedCents, c.targetCents);
  const recentDonations = donations.slice(0, 20);

  return (
    <main style={{ minHeight: "100vh", background: "#0f172a", color: "#f1f5f9" }}>
      <section style={{ padding: "32px 24px 16px" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          <div style={{ fontSize: 12, marginBottom: 16 }}>
            <Link href="/qgood/campaigns" style={{ color: "#94a3b8", textDecoration: "none" }}>← All campaigns</Link>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            <span style={pillStyle}>{c.category}</span>
            {c.country && <span style={pillStyle}>{c.country}</span>}
            {c.status !== "active" && (
              <span style={{ ...pillStyle, color: "#fbbf24", borderColor: "rgba(251,191,36,0.4)", background: "rgba(251,191,36,0.12)" }}>
                {c.status}
              </span>
            )}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 28, alignItems: "flex-start" }}>
            <div style={{ flex: "2 1 520px", minWidth: 280 }}>
              {c.imageUrl && (
                <div style={{ marginBottom: 18, borderRadius: 12, overflow: "hidden", border: "1px solid #334155" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={c.imageUrl}
                    alt={c.title}
                    style={{ display: "block", width: "100%", height: "auto", maxHeight: 360, objectFit: "cover" }}
                  />
                </div>
              )}

              <h1 style={{ fontSize: 32, fontWeight: 900, margin: 0, lineHeight: 1.2, marginBottom: 14 }}>{c.title}</h1>

              <p style={{ fontSize: 15, lineHeight: 1.65, color: "#cbd5e1", margin: 0, marginBottom: 24, whiteSpace: "pre-wrap" }}>
                {c.description}
              </p>

              <div style={{ padding: 18, background: "#1e293b", border: "1px solid #334155", borderRadius: 12, marginBottom: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <span style={{ fontSize: 22, fontWeight: 900, color: "#34d399" }}>
                      {fmtMoney(c.raisedCents, c.currency)}
                    </span>
                    <span style={{ fontSize: 13, color: "#94a3b8", marginLeft: 8 }}>
                      raised of {fmtMoney(c.targetCents, c.currency)}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "#94a3b8" }}>
                    {c.donorCount} donor{c.donorCount === 1 ? "" : "s"} · <span style={{ color: "#34d399", fontWeight: 700 }}>{pct}%</span>
                  </div>
                </div>
                <div style={{ height: 8, background: "#0f172a", borderRadius: 999, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: "#10b981", transition: "width 0.4s ease" }} />
                </div>
                <div style={{ fontSize: 10, color: "#64748b", marginTop: 10, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                  Created {timeAgo(c.createdAt)}
                  {c.approvedAt ? ` · approved ${timeAgo(c.approvedAt)}` : ""}
                  {c.closedAt ? ` · closed ${timeAgo(c.closedAt)}` : ""}
                </div>
              </div>
            </div>

            <aside style={{ flex: "1 1 320px", minWidth: 280, maxWidth: 420, display: "flex", flexDirection: "column", gap: 18 }}>
              <DonateForm campaignId={c.id} currency={c.currency} status={c.status} />

              <div style={{ padding: 16, background: "#1e293b", border: "1px solid #334155", borderRadius: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#94a3b8", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 12 }}>
                  Recent donations
                </div>
                {recentDonations.length === 0 ? (
                  <div style={{ fontSize: 12, color: "#64748b", textAlign: "center", padding: "12px 0" }}>
                    Be the first to support this campaign.
                  </div>
                ) : (
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                    {recentDonations.map((d) => {
                      const name = d.anonymous || !d.donorName ? "Anonymous" : d.donorName;
                      return (
                        <li key={d.id} style={{ paddingBottom: 12, borderBottom: "1px solid #334155" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>
                              {name}
                            </span>
                            <span style={{ fontSize: 13, fontWeight: 800, color: "#34d399", whiteSpace: "nowrap" }}>
                              {fmtMoney(d.amountCents, d.currency)}
                            </span>
                          </div>
                          {d.messageText && (
                            <div style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.5, marginBottom: 4, wordBreak: "break-word" }}>
                              &ldquo;{d.messageText}&rdquo;
                            </div>
                          )}
                          <div style={{ fontSize: 10, color: "#64748b" }}>{timeAgo(d.createdAt)}</div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section style={{ padding: "0 24px 64px" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          <div style={{ padding: 16, background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 12, fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
            <span style={{ color: "#34d399", fontWeight: 800 }}>Audit-trail by QRight + VeilNetX.</span>{" "}
            Every donation on QGood is anchored on AEVION&apos;s public ledger. View the chain on the{" "}
            <Link href="/qgood" style={{ color: "#34d399", textDecoration: "underline" }}>QGood homepage</Link>{" "}
            or learn more about{" "}
            <Link href="/qright" style={{ color: "#34d399", textDecoration: "underline" }}>QRight</Link>.
          </div>
        </div>
      </section>
    </main>
  );
}

const pillStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "4px 10px",
  background: "rgba(16,185,129,0.12)",
  border: "1px solid rgba(16,185,129,0.3)",
  borderRadius: 999,
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "#6ee7b7",
};
