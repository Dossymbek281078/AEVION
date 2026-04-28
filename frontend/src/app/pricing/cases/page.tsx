"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ProductPageShell } from "@/components/ProductPageShell";
import { apiUrl } from "@/lib/apiBase";
import { track } from "@/lib/track";
import { usePricingT } from "@/lib/pricingI18n";

type CaseIndustry = "banks" | "startups" | "government" | "creators" | "law-firms" | "media";
type CaseTier = "free" | "pro" | "business" | "enterprise";

interface CaseMetric {
  label: string;
  before: string;
  after: string;
  delta: string;
  direction: "positive" | "negative";
}

interface CaseStudy {
  id: string;
  customer: string;
  customerInitials: string;
  customerColor: string;
  industry: CaseIndustry;
  region: string;
  tier: CaseTier;
  modules: string[];
  hook: string;
  challenge: string;
  solution: string;
  outcome: string;
  metrics: CaseMetric[];
  quote: { text: string; author: string; role: string };
  date: string;
}

const CARD = "0 4px 20px rgba(15,23,42,0.06)";
const BORDER = "1px solid rgba(15,23,42,0.08)";

const TIER_BADGE: Record<CaseTier, { bg: string; fg: string }> = {
  free: { bg: "#f1f5f9", fg: "#475569" },
  pro: { bg: "#ccfbf1", fg: "#0f766e" },
  business: { bg: "#dbeafe", fg: "#1e40af" },
  enterprise: { bg: "#0f172a", fg: "#f8fafc" },
};

const INDUSTRY_LABEL: Record<CaseIndustry, string> = {
  banks: "Банки и финтех",
  startups: "Стартапы",
  government: "Госсектор",
  creators: "Создатели контента",
  "law-firms": "Юр. фирмы",
  media: "Медиа",
};

export default function PricingCasesPage() {
  const tp = usePricingT();
  const [cases, setCases] = useState<CaseStudy[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterIndustry, setFilterIndustry] = useState<CaseIndustry | null>(null);
  const [filterTier, setFilterTier] = useState<CaseTier | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    fetch(apiUrl("/api/pricing/cases"))
      .then((r) => r.json())
      .then((j: { items: CaseStudy[] }) => setCases(j.items))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
    track({ type: "page_view", source: "pricing/cases" });
  }, []);

  const filtered = useMemo(() => {
    if (!cases) return [];
    return cases.filter(
      (c) =>
        (!filterIndustry || c.industry === filterIndustry) &&
        (!filterTier || c.tier === filterTier),
    );
  }, [cases, filterIndustry, filterTier]);

  const industryCounts = useMemo(() => {
    const m: Partial<Record<CaseIndustry, number>> = {};
    for (const c of cases ?? []) m[c.industry] = (m[c.industry] ?? 0) + 1;
    return m;
  }, [cases]);

  const tierCounts = useMemo(() => {
    const m: Partial<Record<CaseTier, number>> = {};
    for (const c of cases ?? []) m[c.tier] = (m[c.tier] ?? 0) + 1;
    return m;
  }, [cases]);

  if (error) {
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
          <h2 style={{ margin: 0, marginBottom: 8 }}>{tp("error.unavailable")}</h2>
          <p style={{ margin: 0 }}>/api/pricing/cases — {error}</p>
        </div>
      </ProductPageShell>
    );
  }

  if (!cases) {
    return (
      <ProductPageShell>
        <div style={{ padding: 60, textAlign: "center", color: "#64748b" }}>
          {tp("loading.pricing")}
        </div>
      </ProductPageShell>
    );
  }

  return (
    <ProductPageShell maxWidth={1080}>
      <div style={{ marginBottom: 16 }}>
        <Link
          href="/pricing"
          style={{ color: "#64748b", fontSize: 13, fontWeight: 600, textDecoration: "none" }}
        >
          {tp("back.allTiers")}
        </Link>
      </div>

      {/* Hero */}
      <section style={{ textAlign: "center", padding: "32px 0 24px" }}>
        <div
          style={{
            display: "inline-block",
            padding: "4px 12px",
            background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
            color: "#fff",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.06em",
            borderRadius: 999,
            marginBottom: 16,
          }}
        >
          {tp("cases.badge")}
        </div>
        <h1
          style={{
            fontSize: 40,
            fontWeight: 900,
            margin: 0,
            marginBottom: 12,
            letterSpacing: "-0.025em",
            color: "#0f172a",
          }}
        >
          {tp("cases.title")}
        </h1>
        <p
          style={{
            fontSize: 16,
            color: "#475569",
            maxWidth: 680,
            margin: "0 auto",
            lineHeight: 1.5,
          }}
        >
          {tp("cases.subtitle")}
        </p>
      </section>

      {/* Filters */}
      <section
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: 28,
          padding: "12px 14px",
          background: "rgba(13,148,136,0.04)",
          borderRadius: 10,
          border: "1px solid rgba(13,148,136,0.12)",
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 800, color: "#475569", letterSpacing: "0.06em" }}>
          {tp("cases.filterIndustry")}
        </span>
        <FilterChip active={filterIndustry === null} onClick={() => setFilterIndustry(null)} label={`Все · ${cases.length}`} />
        {(Object.keys(INDUSTRY_LABEL) as CaseIndustry[]).map((k) => {
          const c = industryCounts[k] ?? 0;
          if (c === 0) return null;
          return (
            <FilterChip
              key={k}
              active={filterIndustry === k}
              onClick={() => setFilterIndustry(filterIndustry === k ? null : k)}
              label={`${INDUSTRY_LABEL[k]} · ${c}`}
            />
          );
        })}
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: "#475569",
            letterSpacing: "0.06em",
            marginLeft: 16,
          }}
        >
          {tp("cases.filterTier")}
        </span>
        {(["pro", "business", "enterprise"] as CaseTier[]).map((t) => {
          const c = tierCounts[t] ?? 0;
          if (c === 0) return null;
          return (
            <FilterChip
              key={t}
              active={filterTier === t}
              onClick={() => setFilterTier(filterTier === t ? null : t)}
              label={`${t.toUpperCase()} · ${c}`}
              color={TIER_BADGE[t].bg === "#0f172a" ? "#0f172a" : "#0d9488"}
            />
          );
        })}
      </section>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div
          style={{
            padding: 40,
            textAlign: "center",
            color: "#64748b",
            background: "#f8fafc",
            borderRadius: 12,
            border: BORDER,
          }}
        >
          {tp("cases.empty")}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {filtered.map((c) => {
            const expanded = activeId === c.id;
            return (
              <article
                key={c.id}
                id={c.id}
                style={{
                  background: "#fff",
                  border: BORDER,
                  borderRadius: 16,
                  padding: 24,
                  boxShadow: CARD,
                  scrollMarginTop: 80,
                }}
              >
                <header
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto 1fr auto",
                    gap: 16,
                    alignItems: "center",
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 12,
                      background: c.customerColor,
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 18,
                      fontWeight: 900,
                      letterSpacing: "0.04em",
                    }}
                  >
                    {c.customerInitials}
                  </div>
                  <div>
                    <h2
                      style={{
                        fontSize: 22,
                        fontWeight: 900,
                        margin: 0,
                        letterSpacing: "-0.02em",
                        color: "#0f172a",
                      }}
                    >
                      {c.customer}
                    </h2>
                    <div
                      style={{
                        fontSize: 12,
                        color: "#64748b",
                        marginTop: 2,
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                        alignItems: "center",
                      }}
                    >
                      <span>{INDUSTRY_LABEL[c.industry]}</span>
                      <span>·</span>
                      <span>{c.region}</span>
                      <span>·</span>
                      <span>{c.date}</span>
                    </div>
                  </div>
                  <div
                    style={{
                      padding: "5px 10px",
                      fontSize: 11,
                      fontWeight: 800,
                      letterSpacing: "0.06em",
                      borderRadius: 6,
                      background: TIER_BADGE[c.tier].bg,
                      color: TIER_BADGE[c.tier].fg,
                    }}
                  >
                    {c.tier.toUpperCase()}
                  </div>
                </header>

                <p
                  style={{
                    fontSize: 17,
                    fontWeight: 800,
                    color: "#0d9488",
                    margin: 0,
                    marginBottom: 16,
                    letterSpacing: "-0.01em",
                    lineHeight: 1.4,
                  }}
                >
                  {c.hook}
                </p>

                {/* Metrics row */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                    gap: 8,
                    marginBottom: 16,
                  }}
                >
                  {c.metrics.map((m, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "10px 12px",
                        background: "#f8fafc",
                        borderRadius: 10,
                        border: BORDER,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          color: "#64748b",
                          letterSpacing: "0.06em",
                          marginBottom: 6,
                          textTransform: "uppercase",
                        }}
                      >
                        {m.label}
                      </div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                        <span style={{ fontSize: 12, color: "#94a3b8", textDecoration: "line-through" }}>
                          {m.before}
                        </span>
                        <span style={{ fontSize: 14, color: "#0f172a", fontWeight: 800 }}>→ {m.after}</span>
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 800,
                          color: m.direction === "positive" ? "#0d9488" : "#dc2626",
                          marginTop: 2,
                        }}
                      >
                        {m.delta}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Toggle button */}
                <button
                  onClick={() => setActiveId(expanded ? null : c.id)}
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#0d9488",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    padding: "6px 0",
                    marginBottom: expanded ? 12 : 0,
                  }}
                >
                  {expanded ? tp("cases.hideDetails") : tp("cases.showDetails")} {expanded ? "↑" : "↓"}
                </button>

                {expanded && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
                    <Block title={tp("cases.challenge")} body={c.challenge} />
                    <Block title={tp("cases.solution")} body={c.solution} />
                    <Block title={tp("cases.outcome")} body={c.outcome} />
                  </div>
                )}

                {/* Quote */}
                <blockquote
                  style={{
                    margin: 0,
                    padding: "14px 18px",
                    background: "linear-gradient(135deg, rgba(13,148,136,0.05), rgba(14,165,233,0.05))",
                    borderLeft: "4px solid #0d9488",
                    borderRadius: 10,
                  }}
                >
                  <p
                    style={{
                      fontSize: 14,
                      color: "#0f172a",
                      margin: 0,
                      lineHeight: 1.5,
                      fontStyle: "italic",
                    }}
                  >
                    «{c.quote.text}»
                  </p>
                  <div style={{ marginTop: 10, fontSize: 12, color: "#475569", fontWeight: 700 }}>
                    — {c.quote.author}, {c.quote.role}
                  </div>
                </blockquote>

                {/* Modules + CTA */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginTop: 16,
                    flexWrap: "wrap",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {c.modules.map((mid) => (
                      <span
                        key={mid}
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "2px 6px",
                          background: "#f1f5f9",
                          color: "#475569",
                          borderRadius: 4,
                          letterSpacing: "0.02em",
                        }}
                      >
                        {mid}
                      </span>
                    ))}
                  </div>
                  <Link
                    href={c.tier === "enterprise" ? "/pricing/contact?tier=enterprise" : `/pricing/${c.tier}`}
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      color: "#0d9488",
                      textDecoration: "none",
                    }}
                  >
                    {tp("cases.tryTier", { tier: c.tier.toUpperCase() })} →
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Final CTA */}
      <section
        style={{
          marginTop: 40,
          marginBottom: 56,
          padding: 28,
          background: "linear-gradient(135deg, #0f172a, #1e293b)",
          borderRadius: 16,
          color: "#f8fafc",
          textAlign: "center",
        }}
      >
        <h3
          style={{
            fontSize: 22,
            fontWeight: 900,
            margin: 0,
            marginBottom: 8,
            letterSpacing: "-0.02em",
          }}
        >
          {tp("cases.ctaTitle")}
        </h3>
        <p style={{ color: "#94a3b8", margin: 0, marginBottom: 18, fontSize: 14 }}>
          {tp("cases.ctaSubtitle")}
        </p>
        <div style={{ display: "inline-flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <Link
            href="/pricing/contact"
            style={{
              padding: "10px 20px",
              fontSize: 13,
              fontWeight: 800,
              borderRadius: 10,
              background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
              color: "#fff",
              textDecoration: "none",
            }}
          >
            {tp("cases.ctaShare")}
          </Link>
          <Link
            href="/pricing"
            style={{
              padding: "10px 20px",
              fontSize: 13,
              fontWeight: 800,
              borderRadius: 10,
              background: "rgba(255,255,255,0.1)",
              color: "#fff",
              textDecoration: "none",
              border: "1px solid rgba(255,255,255,0.2)",
            }}
          >
            {tp("cases.ctaBack")}
          </Link>
        </div>
      </section>
    </ProductPageShell>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  color = "#0d9488",
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 12px",
        fontSize: 12,
        fontWeight: 800,
        borderRadius: 999,
        border: active ? "none" : "1px solid rgba(15,23,42,0.12)",
        cursor: "pointer",
        background: active ? color : "#fff",
        color: active ? "#fff" : "#475569",
      }}
    >
      {label}
    </button>
  );
}

function Block({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3
        style={{
          fontSize: 11,
          fontWeight: 800,
          color: "#0d9488",
          letterSpacing: "0.08em",
          margin: 0,
          marginBottom: 6,
          textTransform: "uppercase",
        }}
      >
        {title}
      </h3>
      <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.55, margin: 0 }}>{body}</p>
    </div>
  );
}
