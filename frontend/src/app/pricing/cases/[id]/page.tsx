"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
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

export default function PricingCaseDetailPage() {
  const tp = usePricingT();
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : null;

  const [c, setCase] = useState<CaseStudy | null>(null);
  const [allCases, setAllCases] = useState<CaseStudy[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(apiUrl(`/api/pricing/cases/${id}`))
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j: CaseStudy) => setCase(j))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
    fetch(apiUrl("/api/pricing/cases"))
      .then((r) => r.json())
      .then((j: { items: CaseStudy[] }) => setAllCases(j.items))
      .catch(() => {});
    track({ type: "page_view", source: `pricing/cases/${id}` });
  }, [id]);

  const related = useMemo(() => {
    if (!c) return [];
    return allCases.filter((x) => x.id !== c.id && x.industry === c.industry).slice(0, 3);
  }, [c, allCases]);

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
          <h2 style={{ margin: 0, marginBottom: 8 }}>{tp("caseDetail.notFound")}</h2>
          <p style={{ margin: 0, fontSize: 13 }}>
            {tp("caseDetail.notFoundBody")} ({error})
          </p>
          <Link href="/pricing/cases" style={{ display: "inline-block", marginTop: 14, color: "#0d9488", fontWeight: 700 }}>
            ← {tp("caseDetail.allCases")}
          </Link>
        </div>
      </ProductPageShell>
    );
  }

  if (!c) {
    return (
      <ProductPageShell>
        <div style={{ padding: 60, textAlign: "center", color: "#64748b" }}>
          {tp("loading.pricing")}
        </div>
      </ProductPageShell>
    );
  }

  return (
    <ProductPageShell maxWidth={920}>
      <div style={{ marginBottom: 16 }}>
        <Link
          href="/pricing/cases"
          style={{ color: "#64748b", fontSize: 13, fontWeight: 600, textDecoration: "none" }}
        >
          ← {tp("caseDetail.allCases")}
        </Link>
      </div>

      {/* Hero */}
      <section
        style={{
          marginBottom: 32,
          padding: 32,
          background: "linear-gradient(135deg, #0f172a, #1e293b)",
          borderRadius: 18,
          color: "#f8fafc",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: -60,
            right: -60,
            width: 220,
            height: 220,
            borderRadius: "50%",
            background: c.customerColor,
            opacity: 0.18,
            filter: "blur(40px)",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 18 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 14,
              background: c.customerColor,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
              fontWeight: 900,
              letterSpacing: "0.04em",
              flexShrink: 0,
            }}
          >
            {c.customerInitials}
          </div>
          <div>
            <h1
              style={{
                fontSize: 32,
                fontWeight: 900,
                margin: 0,
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
              }}
            >
              {c.customer}
            </h1>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span>{INDUSTRY_LABEL[c.industry]}</span>
              <span>·</span>
              <span>{c.region}</span>
              <span>·</span>
              <span>{c.date}</span>
              <span>·</span>
              <span
                style={{
                  padding: "2px 8px",
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.06em",
                  borderRadius: 4,
                  background: TIER_BADGE[c.tier].bg,
                  color: TIER_BADGE[c.tier].fg,
                }}
              >
                {c.tier.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
        <p
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: "#5eead4",
            margin: 0,
            lineHeight: 1.4,
            letterSpacing: "-0.01em",
            position: "relative",
          }}
        >
          {c.hook}
        </p>
      </section>

      {/* Big metrics */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 36,
        }}
      >
        {c.metrics.map((m, i) => (
          <div
            key={i}
            style={{
              padding: 18,
              background: "#fff",
              border: BORDER,
              borderRadius: 14,
              boxShadow: CARD,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: "#64748b",
                letterSpacing: "0.06em",
                marginBottom: 8,
                textTransform: "uppercase",
              }}
            >
              {m.label}
            </div>
            <div
              style={{
                fontSize: 26,
                fontWeight: 900,
                color: m.direction === "positive" ? "#0d9488" : "#dc2626",
                letterSpacing: "-0.02em",
                marginBottom: 6,
              }}
            >
              {m.delta}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, fontSize: 13 }}>
              <span style={{ color: "#94a3b8", textDecoration: "line-through" }}>{m.before}</span>
              <span style={{ color: "#0f172a", fontWeight: 800 }}>→ {m.after}</span>
            </div>
          </div>
        ))}
      </section>

      {/* Sections */}
      <section style={{ display: "grid", gap: 16, marginBottom: 36 }}>
        <Block title={tp("cases.challenge")} body={c.challenge} accent="#dc2626" />
        <Block title={tp("cases.solution")} body={c.solution} accent="#0d9488" />
        <Block title={tp("cases.outcome")} body={c.outcome} accent="#0ea5e9" />
      </section>

      {/* Quote */}
      <blockquote
        style={{
          margin: 0,
          marginBottom: 36,
          padding: "28px 32px",
          background: "linear-gradient(135deg, rgba(13,148,136,0.05), rgba(14,165,233,0.05))",
          borderLeft: "5px solid #0d9488",
          borderRadius: 14,
        }}
      >
        <p
          style={{
            fontSize: 18,
            color: "#0f172a",
            margin: 0,
            lineHeight: 1.55,
            fontStyle: "italic",
            letterSpacing: "-0.005em",
          }}
        >
          «{c.quote.text}»
        </p>
        <div
          style={{
            marginTop: 16,
            fontSize: 13,
            color: "#475569",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span style={{ color: "#0d9488" }}>—</span> {c.quote.author}, {c.quote.role}
        </div>
      </blockquote>

      {/* Stack */}
      <section
        style={{
          marginBottom: 36,
          padding: 20,
          background: "#fff",
          border: BORDER,
          borderRadius: 14,
          boxShadow: CARD,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 800, color: "#475569", letterSpacing: "0.06em", marginBottom: 10 }}>
          {tp("caseDetail.stackTitle")}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {c.modules.map((m) => (
            <span
              key={m}
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: "5px 10px",
                background: "#f1f5f9",
                color: "#0f172a",
                borderRadius: 6,
                fontFamily: "ui-monospace, monospace",
                letterSpacing: "0.02em",
              }}
            >
              {m}
            </span>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section
        style={{
          marginBottom: 36,
          padding: 28,
          background: "#fff",
          border: BORDER,
          borderRadius: 16,
          boxShadow: CARD,
          textAlign: "center",
        }}
      >
        <h3 style={{ fontSize: 20, fontWeight: 900, margin: 0, marginBottom: 8, letterSpacing: "-0.02em" }}>
          {tp("caseDetail.ctaTitle", { tier: c.tier.toUpperCase() })}
        </h3>
        <p style={{ color: "#475569", margin: 0, marginBottom: 18, fontSize: 14, maxWidth: 540, marginLeft: "auto", marginRight: "auto" }}>
          {tp("caseDetail.ctaSubtitle")}
        </p>
        <div style={{ display: "inline-flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          {c.tier === "enterprise" ? (
            <Link
              href="/pricing/contact?tier=enterprise"
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
              {tp("caseDetail.ctaEnterprise")}
            </Link>
          ) : (
            <Link
              href={`/pricing/${c.tier}`}
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
              {tp("caseDetail.ctaTier", { tier: c.tier.toUpperCase() })}
            </Link>
          )}
          <Link
            href="/pricing#calculator"
            style={{
              padding: "10px 20px",
              fontSize: 13,
              fontWeight: 800,
              borderRadius: 10,
              background: "#f1f5f9",
              color: "#0f172a",
              textDecoration: "none",
            }}
          >
            {tp("caseDetail.ctaCalculator")}
          </Link>
        </div>
      </section>

      {/* Related */}
      {related.length > 0 && (
        <section style={{ marginBottom: 56 }}>
          <h2 style={{ fontSize: 18, fontWeight: 900, margin: 0, marginBottom: 12, letterSpacing: "-0.02em" }}>
            {tp("caseDetail.relatedTitle")} {INDUSTRY_LABEL[c.industry]}
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 12,
            }}
          >
            {related.map((r) => (
              <Link
                key={r.id}
                href={`/pricing/cases/${r.id}`}
                style={{
                  padding: 18,
                  background: "#fff",
                  border: BORDER,
                  borderRadius: 12,
                  boxShadow: CARD,
                  textDecoration: "none",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: r.customerColor,
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 13,
                      fontWeight: 900,
                    }}
                  >
                    {r.customerInitials}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", lineHeight: 1.3 }}>{r.customer}</div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>{r.region}</div>
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: "#475569", lineHeight: 1.5 }}>{r.hook}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </ProductPageShell>
  );
}

function Block({ title, body, accent }: { title: string; body: string; accent: string }) {
  return (
    <div
      style={{
        padding: 24,
        background: "#fff",
        border: BORDER,
        borderRadius: 14,
        boxShadow: CARD,
        borderLeft: `4px solid ${accent}`,
      }}
    >
      <h3
        style={{
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: "0.08em",
          color: accent,
          margin: 0,
          marginBottom: 10,
          textTransform: "uppercase",
        }}
      >
        {title}
      </h3>
      <p style={{ fontSize: 15, color: "#0f172a", lineHeight: 1.65, margin: 0 }}>{body}</p>
    </div>
  );
}
