import type { Metadata } from "next";
import Link from "next/link";
import { getApiBase } from "@/lib/apiBase";
import AdminPanel from "./AdminPanel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "QGood Matching Pools · AEVION",
  description:
    "Active matching pools auto-match donations across QGood campaigns. Audit-trail through QRight + VeilNetX ledger.",
  alternates: { canonical: "https://aevion.app/qgood/matching-pools" },
  openGraph: {
    type: "website",
    url: "https://aevion.app/qgood/matching-pools",
    title: "QGood Matching Pools — auto-match donations",
    description:
      "Active pools auto-match donations across campaigns. When you donate, the system instantly matches up to the pool's remaining balance and cap.",
    siteName: "AEVION",
  },
  robots: { index: true, follow: true },
};

export type MatchingPool = {
  id: string;
  label: string;
  currency: string;
  totalCents: string | number;
  remainingCents: string | number;
  matchRatio: string | number;
  maxMatchPerDonationCents: string | number;
  status: string;
  createdAt: string;
};

async function loadPools(): Promise<MatchingPool[]> {
  try {
    const r = await fetch(`${getApiBase()}/api/qgood/matching-pools`, {
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return [];
    const data = await r.json();
    return Array.isArray(data?.pools) ? data.pools : [];
  } catch {
    return [];
  }
}

function toNum(v: string | number | undefined | null): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
}

function fmtMoney(cents: string | number, currency = "USD"): string {
  const n = toNum(cents);
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(n / 100);
  } catch {
    return `$${Math.round(n / 100).toLocaleString("en-US")}`;
  }
}

function fmtRatio(r: string | number): string {
  const n = toNum(r);
  return `${n.toFixed(1)}x`;
}

function relTime(iso: string): string {
  try {
    const t = new Date(iso).getTime();
    if (!Number.isFinite(t)) return "";
    const diff = Date.now() - t;
    const sec = Math.max(1, Math.round(diff / 1000));
    if (sec < 60) return `${sec}s ago`;
    const min = Math.round(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.round(min / 60);
    if (hr < 48) return `${hr}h ago`;
    const day = Math.round(hr / 24);
    if (day < 30) return `${day}d ago`;
    const mo = Math.round(day / 30);
    if (mo < 12) return `${mo}mo ago`;
    return `${Math.round(mo / 12)}y ago`;
  } catch {
    return "";
  }
}

function statusColors(status: string, remainingCents: string | number, totalCents: string | number) {
  const remaining = toNum(remainingCents);
  const total = toNum(totalCents);
  const pctRemaining = total > 0 ? remaining / total : 0;

  if (status === "paused") {
    return { bg: "rgba(251,191,36,0.15)", border: "rgba(251,191,36,0.4)", text: "#fbbf24", bar: "#fbbf24" };
  }
  if (status === "exhausted" || remaining <= 0) {
    return { bg: "rgba(100,116,139,0.18)", border: "rgba(100,116,139,0.4)", text: "#94a3b8", bar: "#64748b" };
  }
  if (pctRemaining < 0.2) {
    return { bg: "rgba(251,191,36,0.15)", border: "rgba(251,191,36,0.4)", text: "#fbbf24", bar: "#fbbf24" };
  }
  return { bg: "rgba(16,185,129,0.15)", border: "rgba(16,185,129,0.4)", text: "#6ee7b7", bar: "#10b981" };
}

function progressPctFilled(remaining: string | number, total: string | number): number {
  const r = toNum(remaining);
  const t = toNum(total);
  if (t <= 0) return 0;
  const used = 1 - r / t;
  return Math.min(100, Math.max(0, Math.round(used * 100)));
}

export default async function QGoodMatchingPoolsPage() {
  const pools = await loadPools();

  const totalFunded = pools.reduce((acc, p) => acc + toNum(p.totalCents), 0);
  const totalRemaining = pools.reduce((acc, p) => acc + toNum(p.remainingCents), 0);
  const displayCurrency = pools[0]?.currency || "USD";

  return (
    <main style={{ minHeight: "100vh", background: "#0f172a", color: "#f1f5f9" }}>
      <section style={{ padding: "32px 24px 8px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ display: "flex", gap: 16, marginBottom: 12, flexWrap: "wrap" }}>
            <Link href="/qgood" style={{ fontSize: 12, color: "#94a3b8", textDecoration: "none" }}>
              ← QGood
            </Link>
            <Link href="/qgood/campaigns" style={{ fontSize: 12, color: "#94a3b8", textDecoration: "none" }}>
              ← Campaigns
            </Link>
          </div>
        </div>
      </section>

      <section style={{ padding: "16px 24px 24px", textAlign: "center" }}>
        <div style={{ maxWidth: 880, margin: "0 auto" }}>
          <div
            style={{
              display: "inline-block",
              padding: "4px 12px",
              background: "rgba(16,185,129,0.15)",
              border: "1px solid rgba(16,185,129,0.4)",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.1em",
              color: "#6ee7b7",
              marginBottom: 16,
            }}
          >
            QGOOD · MATCHING POOLS
          </div>
          <h1 style={{ fontSize: 38, fontWeight: 900, margin: 0, lineHeight: 1.1, marginBottom: 12 }}>
            Matching <span style={{ color: "#34d399" }}>pools</span>
          </h1>
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.55,
              color: "#94a3b8",
              maxWidth: 640,
              margin: "0 auto",
            }}
          >
            Active pools auto-match donations across campaigns. When you donate, the system instantly matches up to the
            pool's remaining balance and cap.
          </p>
        </div>
      </section>

      <section style={{ padding: "0 24px 20px" }}>
        <div
          style={{
            maxWidth: 1000,
            margin: "0 auto",
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <Pill label={`${pools.length} pool${pools.length === 1 ? "" : "s"}`} />
          <Pill label={`${fmtMoney(totalFunded, displayCurrency)} funded`} />
          <Pill label={`${fmtMoney(totalRemaining, displayCurrency)} remaining`} accent />
        </div>
      </section>

      <section style={{ padding: "8px 24px 32px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          {pools.length === 0 ? (
            <div
              style={{
                padding: 32,
                textAlign: "center",
                background: "#1e293b",
                border: "1px dashed #334155",
                borderRadius: 12,
                color: "#94a3b8",
              }}
            >
              <div style={{ fontSize: 40, marginBottom: 10 }}>🤝</div>
              <p style={{ color: "#cbd5e1", fontSize: 14, fontWeight: 600, marginTop: 0, marginBottom: 6 }}>Matching pools пока не созданы</p>
              <p style={{ fontSize: 12, marginTop: 4, marginBottom: 0 }}>Админы могут фондировать первый пул через панель ниже.</p>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))",
                gap: 14,
              }}
            >
              {pools.map((p) => (
                <PoolCard key={p.id} p={p} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section style={{ padding: "0 24px 64px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <AdminPanel pools={pools} />
        </div>
      </section>
    </main>
  );
}

function Pill({ label, accent }: { label: string; accent?: boolean }) {
  return (
    <div
      style={{
        padding: "8px 16px",
        background: accent ? "rgba(16,185,129,0.12)" : "#1e293b",
        border: `1px solid ${accent ? "rgba(16,185,129,0.4)" : "#334155"}`,
        borderRadius: 999,
        fontSize: 13,
        fontWeight: 700,
        color: accent ? "#6ee7b7" : "#f1f5f9",
      }}
    >
      {label}
    </div>
  );
}

function PoolCard({ p }: { p: MatchingPool }) {
  const c = statusColors(p.status, p.remainingCents, p.totalCents);
  const pct = progressPctFilled(p.remainingCents, p.totalCents);
  return (
    <div
      style={{
        padding: 16,
        background: "#1e293b",
        border: "1px solid #334155",
        borderRadius: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          alignItems: "flex-start",
          marginBottom: 10,
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, lineHeight: 1.3, color: "#f1f5f9" }}>{p.label}</h3>
        <div
          style={{
            padding: "3px 10px",
            background: c.bg,
            border: `1px solid ${c.border}`,
            borderRadius: 999,
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase" as const,
            color: c.text,
            whiteSpace: "nowrap" as const,
          }}
        >
          {p.status}
        </div>
      </div>

      <div
        style={{
          height: 6,
          background: "#0f172a",
          borderRadius: 999,
          overflow: "hidden",
          marginBottom: 8,
        }}
      >
        <div style={{ height: "100%", width: `${pct}%`, background: c.bar }} />
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 12,
          color: "#94a3b8",
          marginBottom: 10,
          flexWrap: "wrap",
          gap: 6,
        }}
      >
        <span>
          <span style={{ color: "#34d399", fontWeight: 700 }}>
            {fmtMoney(p.remainingCents, p.currency)}
          </span>{" "}
          remaining
        </span>
        <span>of {fmtMoney(p.totalCents, p.currency)}</span>
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          fontSize: 11,
          color: "#94a3b8",
        }}
      >
        <span
          style={{
            padding: "3px 9px",
            background: "#0f172a",
            border: "1px solid #334155",
            borderRadius: 999,
          }}
        >
          {fmtRatio(p.matchRatio)} match
        </span>
        <span
          style={{
            padding: "3px 9px",
            background: "#0f172a",
            border: "1px solid #334155",
            borderRadius: 999,
          }}
        >
          max {fmtMoney(p.maxMatchPerDonationCents, p.currency)} per donation
        </span>
        <span style={{ marginLeft: "auto", color: "#64748b", padding: "3px 0" }}>{relTime(p.createdAt)}</span>
      </div>
    </div>
  );
}
