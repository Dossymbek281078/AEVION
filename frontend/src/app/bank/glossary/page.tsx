"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { InstallBanner } from "../_components/InstallBanner";
import { SubrouteFooter } from "../_components/SubrouteFooter";

type Term = {
  id: string;
  group: GroupId;
  /** Optional href for cross-linking to a deeper page. */
  href?: string;
};

type GroupId = "currency" | "trust" | "saving" | "credit" | "privacy" | "social" | "ecosystem";

const GROUPS: Array<{ id: GroupId; accent: string; glyph: string }> = [
  { id: "currency", accent: "#5eead4", glyph: "₳" },
  { id: "trust", accent: "#a78bfa", glyph: "◯" },
  { id: "saving", accent: "#fbbf24", glyph: "✦" },
  { id: "credit", accent: "#0ea5e9", glyph: "◯" },
  { id: "privacy", accent: "#f472b6", glyph: "⛨" },
  { id: "social", accent: "#7c3aed", glyph: "◌" },
  { id: "ecosystem", accent: "#0d9488", glyph: "◉" },
];

const TERMS: Term[] = [
  // currency
  { id: "aec", group: "currency" },
  { id: "accountId", group: "currency" },
  { id: "balance", group: "currency" },
  { id: "topup", group: "currency" },
  { id: "displayCurrency", group: "currency" },
  // trust
  { id: "trustScore", group: "trust", href: "/bank/trust" },
  { id: "trustTier", group: "trust", href: "/bank/trust" },
  { id: "factor", group: "trust", href: "/bank/trust" },
  { id: "engagementBonus", group: "trust" },
  // saving
  { id: "goal", group: "saving", href: "/bank/savings" },
  { id: "vault", group: "saving", href: "/bank/savings" },
  { id: "roundUp", group: "saving", href: "/bank/savings" },
  { id: "apy", group: "saving" },
  { id: "earlyClaim", group: "saving" },
  // credit
  { id: "salaryAdvance", group: "credit" },
  { id: "creditLimit", group: "credit", href: "/bank/trust" },
  // privacy
  { id: "qsign", group: "privacy", href: "/bank/security" },
  { id: "ed25519", group: "privacy" },
  { id: "biometric", group: "privacy", href: "/bank/security" },
  { id: "auditLog", group: "privacy" },
  { id: "anomaly", group: "privacy", href: "/bank/security" },
  { id: "export", group: "privacy" },
  // social
  { id: "circle", group: "social", href: "/bank/circles" },
  { id: "split", group: "social" },
  { id: "gift", group: "social" },
  { id: "paymentRequest", group: "social" },
  { id: "recurring", group: "social" },
  { id: "contact", group: "social", href: "/bank/contacts" },
  // ecosystem
  { id: "qright", group: "ecosystem" },
  { id: "cyberchess", group: "ecosystem" },
  { id: "planet", group: "ecosystem" },
  { id: "qcoreai", group: "ecosystem" },
  { id: "multichat", group: "ecosystem" },
];

export default function GlossaryPage() {
  const { t } = useI18n();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TERMS;
    return TERMS.filter(
      (term) =>
        (t(`glossary.${term.id}.term`) ?? "").toLowerCase().includes(q) ||
        (t(`glossary.${term.id}.def`) ?? "").toLowerCase().includes(q),
    );
  }, [query, t]);

  const grouped = useMemo(() => {
    return GROUPS.map((g) => ({
      group: g,
      items: filtered.filter((term) => term.group === g.id),
    })).filter((b) => b.items.length > 0);
  }, [filtered]);

  // FAQ-style schema.org JSON-LD: each term becomes a DefinedTerm.
  const jsonLd = useMemo(() => {
    return {
      "@context": "https://schema.org",
      "@type": "DefinedTermSet",
      name: "AEVION Bank Glossary",
      hasDefinedTerm: TERMS.map((term) => ({
        "@type": "DefinedTerm",
        name: t(`glossary.${term.id}.term`),
        description: t(`glossary.${term.id}.def`),
      })),
    };
  }, [t]);

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 50% 0%, rgba(13,148,136,0.18), transparent 60%), linear-gradient(180deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)",
        color: "#f8fafc",
        padding: "32px 16px 56px",
      }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <Link
          href="/bank"
          style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", textDecoration: "none", fontWeight: 700 }}
        >
          ← {t("about.backToBank")}
        </Link>

        <header style={{ marginTop: 18, marginBottom: 20 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 6,
              color: "#5eead4",
              textTransform: "uppercase",
            }}
          >
            {t("glossaryPage.kicker")}
          </div>
          <h1 style={{ fontSize: 40, fontWeight: 900, letterSpacing: -1.2, lineHeight: 1.05, marginTop: 14, marginBottom: 8 }}>
            {t("glossaryPage.headline")}
          </h1>
          <div style={{ fontSize: 15, color: "#cbd5e1", lineHeight: 1.55, maxWidth: 640 }}>
            {t("glossaryPage.lede", { count: TERMS.length })}
          </div>
        </header>

        {/* Search */}
        <input
          type="search"
          placeholder={t("glossaryPage.searchPlaceholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={t("glossaryPage.searchAria")}
          style={{
            width: "100%",
            padding: "11px 14px",
            borderRadius: 10,
            background: "rgba(15,23,42,0.55)",
            border: "1px solid rgba(255,255,255,0.10)",
            color: "#fff",
            fontSize: 14,
            outline: "none",
            marginBottom: 16,
          }}
        />

        {/* Group nav (hidden during search) */}
        {!query && (
          <nav
            aria-label={t("glossaryPage.tocAria")}
            style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}
          >
            {GROUPS.map((g) => (
              <a
                key={g.id}
                href={`#${g.id}`}
                style={{
                  padding: "8px 14px",
                  borderRadius: 999,
                  border: `1px solid ${g.accent}40`,
                  color: g.accent,
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "rgba(15,23,42,0.55)",
                }}
              >
                <span aria-hidden>{g.glyph}</span>
                {t(`glossaryPage.group.${g.id}`)}
              </a>
            ))}
          </nav>
        )}

        {grouped.length === 0 && (
          <div
            style={{
              padding: 24,
              borderRadius: 14,
              background: "rgba(220,38,38,0.10)",
              border: "1px solid rgba(220,38,38,0.30)",
              textAlign: "center",
              color: "#fecaca",
            }}
          >
            {t("glossaryPage.searchEmpty", { q: query })}
          </div>
        )}

        {grouped.map(({ group, items }) => (
          <section
            key={group.id}
            id={group.id}
            style={{ marginBottom: 28, scrollMarginTop: 80 }}
          >
            <div style={{ marginBottom: 12 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: 4,
                  textTransform: "uppercase",
                  color: group.accent,
                }}
              >
                {group.glyph} · {t(`glossaryPage.group.${group.id}`)}
              </div>
            </div>
            <dl style={{ display: "flex", flexDirection: "column", gap: 8, margin: 0 }}>
              {items.map((term) => (
                <div
                  key={term.id}
                  style={{
                    padding: "14px 16px",
                    borderRadius: 12,
                    background: "rgba(15,23,42,0.55)",
                    border: `1px solid ${group.accent}1a`,
                  }}
                >
                  <dt
                    style={{
                      fontSize: 16,
                      fontWeight: 800,
                      color: "#fff",
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <span>{t(`glossary.${term.id}.term`)}</span>
                    {term.href && (
                      <Link
                        href={term.href}
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          letterSpacing: 1,
                          textTransform: "uppercase",
                          color: group.accent,
                          textDecoration: "none",
                          padding: "2px 8px",
                          borderRadius: 999,
                          border: `1px solid ${group.accent}40`,
                          background: `${group.accent}10`,
                        }}
                      >
                        {t("glossaryPage.readMore")} →
                      </Link>
                    )}
                  </dt>
                  <dd style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6, margin: "6px 0 0 0" }}>
                    {t(`glossary.${term.id}.def`)}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}

        {/* CTA */}
        <section
          style={{
            padding: 22,
            borderRadius: 16,
            background: "linear-gradient(135deg, rgba(13,148,136,0.18), rgba(99,102,241,0.10))",
            border: "1px solid rgba(94,234,212,0.30)",
            marginTop: 8,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 4, color: "#5eead4", textTransform: "uppercase" }}>
            {t("glossaryPage.cta.kicker")}
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, marginTop: 6, lineHeight: 1.25 }}>
            {t("glossaryPage.cta.title")}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            <Link href="/bank/help" style={ctaSecondary}>
              {t("help.cta.security")} · {t("trust.page.cta.aboutLink")} →
            </Link>
            <Link href="/bank" style={ctaPrimary}>
              {t("about.cta.openBank")}
            </Link>
          </div>
        </section>

        <div style={{ marginTop: 16 }}>
          <InstallBanner />
        </div>
        <div style={{ marginTop: 16 }}>
          <SubrouteFooter />
        </div>
      </div>
    </main>
  );
}

const ctaPrimary: React.CSSProperties = {
  padding: "12px 20px",
  borderRadius: 12,
  background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
  color: "#fff",
  fontSize: 13,
  fontWeight: 800,
  textDecoration: "none",
};

const ctaSecondary: React.CSSProperties = {
  padding: "12px 20px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.04)",
  color: "#fff",
  fontSize: 13,
  fontWeight: 800,
  textDecoration: "none",
};
