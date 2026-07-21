"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { apiUrl } from "@/lib/apiBase";
import { track } from "@/lib/track";
import { useI18n } from "@/lib/i18n";

type CurrencyCode = "USD" | "EUR" | "KZT" | "RUB";
type BillingPeriod = "monthly" | "annual";
type TierId = "free" | "lite" | "medium" | "full" | "enterprise";

interface PricingTier {
  id: TierId;
  name: string;
  tagline: string;
  priceMonthly: number | null;
  priceAnnualPerMonth: number | null;
  priceAnnualTotal: number | null;
  features: string[];
  limits: {
    modules: number | null;
    qrightObjectsPerMonth: number | null;
    qsignOpsPerDay: number | null;
    llmTokensPerMonth: number | null;
    seats: number | null;
    supportSlaHours: number | null;
  };
  ctaLabel: string;
  highlight?: boolean;
}

interface ModulePrice {
  id: string;
  name: string;
  code: string;
  addonMonthly: number | null;
  includedIn: TierId[];
  availability: "live" | "beta" | "soon" | "on_request";
  oneLiner: string;
}

interface PricingPayload {
  tiers: PricingTier[];
  modules: ModulePrice[];
  currencies: Record<CurrencyCode, { rate: number; symbol: string; label: string }>;
}

// Values below are i18n keys under "pricing.tierDetail.faq.*", resolved via
// t() at render time (this object is module-level, outside the component).
const TIER_FAQ: Record<TierId, { q: string; a: string }[]> = {
  free: [
    { q: "pricing.tierDetail.faq.free.q1", a: "pricing.tierDetail.faq.free.a1" },
    { q: "pricing.tierDetail.faq.free.q2", a: "pricing.tierDetail.faq.free.a2" },
    { q: "pricing.tierDetail.faq.free.q3", a: "pricing.tierDetail.faq.free.a3" },
  ],
  lite: [
    { q: "pricing.tierDetail.faq.lite.q1", a: "pricing.tierDetail.faq.lite.a1" },
    { q: "pricing.tierDetail.faq.lite.q2", a: "pricing.tierDetail.faq.lite.a2" },
    { q: "pricing.tierDetail.faq.lite.q3", a: "pricing.tierDetail.faq.lite.a3" },
    { q: "pricing.tierDetail.faq.lite.q4", a: "pricing.tierDetail.faq.lite.a4" },
  ],
  medium: [
    { q: "pricing.tierDetail.faq.medium.q1", a: "pricing.tierDetail.faq.medium.a1" },
    { q: "pricing.tierDetail.faq.medium.q2", a: "pricing.tierDetail.faq.medium.a2" },
    { q: "pricing.tierDetail.faq.medium.q3", a: "pricing.tierDetail.faq.medium.a3" },
    { q: "pricing.tierDetail.faq.medium.q4", a: "pricing.tierDetail.faq.medium.a4" },
  ],
  full: [
    { q: "pricing.tierDetail.faq.full.q1", a: "pricing.tierDetail.faq.full.a1" },
    { q: "pricing.tierDetail.faq.full.q2", a: "pricing.tierDetail.faq.full.a2" },
    { q: "pricing.tierDetail.faq.full.q3", a: "pricing.tierDetail.faq.full.a3" },
    { q: "pricing.tierDetail.faq.full.q4", a: "pricing.tierDetail.faq.full.a4" },
  ],
  enterprise: [
    { q: "pricing.tierDetail.faq.enterprise.q1", a: "pricing.tierDetail.faq.enterprise.a1" },
    { q: "pricing.tierDetail.faq.enterprise.q2", a: "pricing.tierDetail.faq.enterprise.a2" },
    { q: "pricing.tierDetail.faq.enterprise.q3", a: "pricing.tierDetail.faq.enterprise.a3" },
    { q: "pricing.tierDetail.faq.enterprise.q4", a: "pricing.tierDetail.faq.enterprise.a4" },
  ],
};

// Values below are i18n keys under "pricing.tierDetail.audience.*", resolved
// via t() at render time (this object is module-level, outside the component).
const TIER_AUDIENCE: Record<TierId, { who: string; usecase: string[]; notFor: string }> = {
  free: {
    who: "pricing.tierDetail.audience.free.who",
    usecase: [
      "pricing.tierDetail.audience.free.usecase1",
      "pricing.tierDetail.audience.free.usecase2",
      "pricing.tierDetail.audience.free.usecase3",
      "pricing.tierDetail.audience.free.usecase4",
    ],
    notFor: "pricing.tierDetail.audience.free.notFor",
  },
  lite: {
    who: "pricing.tierDetail.audience.lite.who",
    usecase: [
      "pricing.tierDetail.audience.lite.usecase1",
      "pricing.tierDetail.audience.lite.usecase2",
      "pricing.tierDetail.audience.lite.usecase3",
      "pricing.tierDetail.audience.lite.usecase4",
    ],
    notFor: "pricing.tierDetail.audience.lite.notFor",
  },
  medium: {
    who: "pricing.tierDetail.audience.medium.who",
    usecase: [
      "pricing.tierDetail.audience.medium.usecase1",
      "pricing.tierDetail.audience.medium.usecase2",
      "pricing.tierDetail.audience.medium.usecase3",
      "pricing.tierDetail.audience.medium.usecase4",
    ],
    notFor: "pricing.tierDetail.audience.medium.notFor",
  },
  full: {
    who: "pricing.tierDetail.audience.full.who",
    usecase: [
      "pricing.tierDetail.audience.full.usecase1",
      "pricing.tierDetail.audience.full.usecase2",
      "pricing.tierDetail.audience.full.usecase3",
      "pricing.tierDetail.audience.full.usecase4",
    ],
    notFor: "pricing.tierDetail.audience.full.notFor",
  },
  enterprise: {
    who: "pricing.tierDetail.audience.enterprise.who",
    usecase: [
      "pricing.tierDetail.audience.enterprise.usecase1",
      "pricing.tierDetail.audience.enterprise.usecase2",
      "pricing.tierDetail.audience.enterprise.usecase3",
      "pricing.tierDetail.audience.enterprise.usecase4",
      "pricing.tierDetail.audience.enterprise.usecase5",
    ],
    notFor: "pricing.tierDetail.audience.enterprise.notFor",
  },
};

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid rgba(15,23,42,0.08)",
        borderRadius: 10,
        marginBottom: 8,
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          padding: "14px 18px",
          background: "transparent",
          border: "none",
          textAlign: "left",
          fontSize: 14,
          fontWeight: 700,
          color: "#0f172a",
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>{q}</span>
        <span style={{ fontSize: 16, color: "#64748b" }}>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div
          style={{
            padding: "0 18px 14px",
            fontSize: 13,
            color: "#475569",
            lineHeight: 1.6,
          }}
        >
          {a}
        </div>
      )}
    </div>
  );
}

function fmtLimit(n: number | null, suffix: string, unlimitedLabel: string): string {
  if (n === null) return unlimitedLabel;
  return `${n.toLocaleString("ru-RU")} ${suffix}`;
}

export default function TierDetailPage() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useParams<{ tierId: string }>();
  const tierId = params?.tierId as TierId;

  const [data, setData] = useState<PricingPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<BillingPeriod>("annual");
  const [currency, setCurrency] = useState<CurrencyCode>("USD");

  useEffect(() => {
    if (tierId) {
      track({ type: "tier_view", tier: tierId, source: "pricing/[tierId]" });
    }
  }, [tierId]);

  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl("/api/pricing"))
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j: PricingPayload) => {
        if (!cancelled) {
          setData(j);
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const tier = useMemo(() => data?.tiers.find((t) => t.id === tierId), [data, tierId]);
  const includedModules = useMemo(() => {
    if (!data || !tier) return [];
    return data.modules.filter((m) => m.includedIn.includes(tier.id));
  }, [data, tier]);

  if (loading) {
    return (
      <ProductPageShell>
        <div style={{ padding: 60, textAlign: "center", color: "#64748b" }}>
          {t("pricing.tierDetail.loading")}
        </div>
      </ProductPageShell>
    );
  }

  if (error || !data) {
    return (
      <ProductPageShell>
        <div
          style={{
            padding: 24,
            background: "#fee2e2",
            border: "1px solid #fca5a5",
            borderRadius: 12,
            color: "#991b1b",
          }}
        >
          <h2 style={{ margin: 0, marginBottom: 8 }}>{t("pricing.tierDetail.error.title")}</h2>
          <p style={{ margin: 0 }}>{error}</p>
        </div>
      </ProductPageShell>
    );
  }

  if (!tier) {
    return (
      <ProductPageShell>
        <div style={{ padding: 24, textAlign: "center" }}>
          <h2>{t("pricing.tierDetail.notFound.title")}</h2>
          <p style={{ color: "#64748b" }}>
            {t("pricing.tierDetail.notFound.idLabel")} <code>{tierId}</code>
          </p>
          <Link href="/pricing" style={{ color: "#0d9488", fontWeight: 700 }}>
            {t("pricing.tierDetail.nav.backToAll")}
          </Link>
        </div>
      </ProductPageShell>
    );
  }

  const symbol = data.currencies[currency].symbol;
  const rate = data.currencies[currency].rate;
  const displayPrice = (usd: number | null): string => {
    if (usd === null) return t("pricing.tierDetail.price.onRequest");
    if (usd === 0) return t("pricing.tierDetail.price.free");
    return `${symbol}${Math.round(usd * rate).toLocaleString("ru-RU")}`;
  };

  const audience = TIER_AUDIENCE[tier.id];
  const faq = TIER_FAQ[tier.id];
  const showPrice = period === "annual" ? tier.priceAnnualPerMonth : tier.priceMonthly;

  return (
    <ProductPageShell maxWidth={1100}>
      <div style={{ marginBottom: 16 }}>
        <Link
          href="/pricing"
          style={{
            color: "#64748b",
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          {t("pricing.tierDetail.nav.backToAll")}
        </Link>
      </div>

      {/* Hero */}
      <section
        style={{
          padding: "32px 0",
          textAlign: "center",
          borderBottom: "1px solid rgba(15,23,42,0.08)",
          marginBottom: 32,
        }}
      >
        <div
          style={{
            display: "inline-block",
            padding: "4px 12px",
            background: tier.id === "enterprise" ? "#0f172a" : "#0d9488",
            color: "#fff",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.06em",
            borderRadius: 999,
            marginBottom: 16,
          }}
        >
          {t("pricing.tierDetail.hero.badge", { tierName: tier.name.toUpperCase() })}
        </div>
        <h1
          style={{
            fontSize: 48,
            fontWeight: 900,
            margin: 0,
            marginBottom: 8,
            letterSpacing: "-0.025em",
            color: "#0f172a",
          }}
        >
          {t("pricing.tierDetail.hero.title", { tierName: tier.name })}
        </h1>
        <p style={{ fontSize: 16, color: "#475569", maxWidth: 600, margin: "8px auto 24px" }}>
          {tier.tagline}
        </p>
        <div style={{ marginBottom: 24 }}>
          <span style={{ fontSize: 56, fontWeight: 900, letterSpacing: "-0.03em", color: "#0f172a" }}>
            {displayPrice(showPrice)}
          </span>
          {showPrice !== null && showPrice > 0 && (
            <span style={{ fontSize: 16, color: "#64748b", marginLeft: 4 }}>{t("pricing.tierDetail.hero.perMonth")}</span>
          )}
        </div>
        <div
          style={{
            display: "inline-flex",
            gap: 12,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              background: "#f1f5f9",
              borderRadius: 10,
              padding: 4,
              gap: 4,
            }}
          >
            {(["monthly", "annual"] as BillingPeriod[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                style={{
                  padding: "6px 14px",
                  fontSize: 12,
                  fontWeight: 700,
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  background: period === p ? "#fff" : "transparent",
                  color: period === p ? "#0f172a" : "#64748b",
                }}
              >
                {p === "monthly" ? t("pricing.tierDetail.hero.periodMonthly") : t("pricing.tierDetail.hero.periodAnnual")}
              </button>
            ))}
          </div>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
            style={{
              padding: "6px 12px",
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 8,
              border: "1px solid rgba(15,23,42,0.08)",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            {Object.entries(data.currencies).map(([code, meta]) => (
              <option key={code} value={code}>
                {meta.symbol} {code}
              </option>
            ))}
          </select>
        </div>
        <div style={{ marginTop: 24 }}>
          {tier.id === "enterprise" ? (
            <Link
              href="/pricing/contact?tier=enterprise"
              style={{
                display: "inline-block",
                padding: "12px 28px",
                fontSize: 14,
                fontWeight: 800,
                borderRadius: 10,
                cursor: "pointer",
                background: "#0f172a",
                color: "#fff",
                textDecoration: "none",
              }}
            >
              {tier.ctaLabel}
            </Link>
          ) : (
            <button
              onClick={() => router.push(`/pricing#calculator`)}
              style={{
                padding: "12px 28px",
                fontSize: 14,
                fontWeight: 800,
                borderRadius: 10,
                border: "none",
                cursor: "pointer",
                background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
                color: "#fff",
              }}
            >
              {tier.ctaLabel}
            </button>
          )}
        </div>
      </section>

      {/* Audience */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 24,
          marginBottom: 40,
        }}
      >
        <div
          style={{
            background: "#f0fdfa",
            border: "1px solid rgba(13,148,136,0.2)",
            borderRadius: 14,
            padding: 24,
          }}
        >
          <h3 style={{ fontSize: 11, fontWeight: 800, color: "#0d9488", letterSpacing: "0.06em", margin: 0, marginBottom: 8 }}>
            {t("pricing.tierDetail.audience.whoTitle")}
          </h3>
          <p style={{ margin: 0, marginBottom: 16, color: "#0f172a", fontSize: 14, lineHeight: 1.5 }}>
            {t(audience.who)}
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, color: "#475569", fontSize: 13, lineHeight: 1.7 }}>
            {audience.usecase.map((u, i) => (
              <li key={i}>{t(u)}</li>
            ))}
          </ul>
        </div>
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: 14,
            padding: 24,
          }}
        >
          <h3 style={{ fontSize: 11, fontWeight: 800, color: "#dc2626", letterSpacing: "0.06em", margin: 0, marginBottom: 8 }}>
            {t("pricing.tierDetail.audience.notForTitle")}
          </h3>
          <p style={{ margin: 0, color: "#7f1d1d", fontSize: 14, lineHeight: 1.5 }}>
            {t(audience.notFor)}
          </p>
        </div>
      </section>

      {/* Features */}
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0, marginBottom: 16, letterSpacing: "-0.02em" }}>
          {t("pricing.tierDetail.features.title")}
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 12,
          }}
        >
          {tier.features.map((f, i) => (
            <div
              key={i}
              style={{
                background: "#fff",
                border: "1px solid rgba(15,23,42,0.08)",
                borderRadius: 10,
                padding: 14,
                fontSize: 13,
                lineHeight: 1.5,
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
              }}
            >
              <span style={{ color: "#0d9488", fontWeight: 800, fontSize: 16 }}>✓</span>
              <span>{f}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Limits */}
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0, marginBottom: 16, letterSpacing: "-0.02em" }}>
          {t("pricing.tierDetail.limits.title")}
        </h2>
        <div
          style={{
            background: "#fff",
            border: "1px solid rgba(15,23,42,0.08)",
            borderRadius: 14,
            overflow: "hidden",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <tbody>
              {[
                [t("pricing.tierDetail.limits.modules"), fmtLimit(tier.limits.modules, t("pricing.tierDetail.limits.unitCount"), t("pricing.tierDetail.price.unlimited"))],
                [t("pricing.tierDetail.limits.qrightObjects"), fmtLimit(tier.limits.qrightObjectsPerMonth, t("pricing.tierDetail.limits.unitCount"), t("pricing.tierDetail.price.unlimited"))],
                [t("pricing.tierDetail.limits.qsignOps"), fmtLimit(tier.limits.qsignOpsPerDay, t("pricing.tierDetail.limits.unitOps"), t("pricing.tierDetail.price.unlimited"))],
                [t("pricing.tierDetail.limits.llmTokens"), fmtLimit(tier.limits.llmTokensPerMonth, t("pricing.tierDetail.limits.unitTokens"), t("pricing.tierDetail.price.unlimited"))],
                [t("pricing.tierDetail.limits.seats"), fmtLimit(tier.limits.seats, t("pricing.tierDetail.limits.unitCount"), t("pricing.tierDetail.price.unlimited"))],
                [
                  t("pricing.tierDetail.limits.supportSla"),
                  tier.limits.supportSlaHours === null
                    ? t("pricing.tierDetail.limits.community")
                    : `${tier.limits.supportSlaHours}h`,
                ],
              ].map(([label, value], i) => (
                <tr key={i} style={{ borderTop: i === 0 ? "none" : "1px solid rgba(15,23,42,0.05)" }}>
                  <td style={{ padding: "12px 16px", color: "#64748b", fontWeight: 600 }}>{label}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 800, color: "#0f172a" }}>
                    {value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Included modules */}
      {includedModules.length > 0 && (
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0, marginBottom: 16, letterSpacing: "-0.02em" }}>
            {t("pricing.tierDetail.modules.title", { count: includedModules.length })}
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 10,
            }}
          >
            {includedModules.map((m) => (
              <div
                key={m.id}
                style={{
                  background: "#fff",
                  border: "1px solid rgba(15,23,42,0.08)",
                  borderRadius: 10,
                  padding: 14,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <strong style={{ fontSize: 13 }}>{m.name}</strong>
                  <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700 }}>{m.code}</span>
                </div>
                <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.4 }}>{m.oneLiner}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* FAQ */}
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0, marginBottom: 16, letterSpacing: "-0.02em" }}>
          {t("pricing.tierDetail.faq.title")}
        </h2>
        <div>
          {faq.map((f, i) => (
            <FAQItem key={i} q={t(f.q)} a={t(f.a)} />
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section
        style={{
          textAlign: "center",
          padding: "32px 0",
          marginBottom: 24,
          borderTop: "1px solid rgba(15,23,42,0.08)",
        }}
      >
        <h2 style={{ fontSize: 24, fontWeight: 900, margin: 0, marginBottom: 8 }}>
          {t("pricing.tierDetail.finalCta.title", { tierName: tier.name })}
        </h2>
        <p style={{ color: "#64748b", margin: 0, marginBottom: 20 }}>
          {tier.id === "free"
            ? t("pricing.tierDetail.finalCta.free")
            : tier.id === "enterprise"
              ? t("pricing.tierDetail.finalCta.enterprise")
              : t("pricing.tierDetail.finalCta.default")}
        </p>
        <div style={{ display: "inline-flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
          {tier.id === "enterprise" ? (
            <Link
              href="/pricing/contact?tier=enterprise"
              style={{
                padding: "12px 24px",
                fontSize: 14,
                fontWeight: 800,
                borderRadius: 10,
                background: "#0f172a",
                color: "#fff",
                textDecoration: "none",
              }}
            >
              {tier.ctaLabel}
            </Link>
          ) : (
            <button
              onClick={() => router.push("/pricing#calculator")}
              style={{
                padding: "12px 24px",
                fontSize: 14,
                fontWeight: 800,
                borderRadius: 10,
                border: "none",
                cursor: "pointer",
                background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
                color: "#fff",
              }}
            >
              {tier.ctaLabel}
            </button>
          )}
          <Link
            href="/pricing"
            style={{
              padding: "12px 24px",
              fontSize: 14,
              fontWeight: 800,
              borderRadius: 10,
              cursor: "pointer",
              background: "#f1f5f9",
              color: "#0f172a",
              textDecoration: "none",
            }}
          >
            {t("pricing.tierDetail.finalCta.compareTiers")}
          </Link>
        </div>
      </section>
    </ProductPageShell>
  );
}
