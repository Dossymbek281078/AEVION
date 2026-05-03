"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { InstallBanner } from "../_components/InstallBanner";
import { SubrouteFooter } from "../_components/SubrouteFooter";

type Section = {
  id: string;
  accent: string;
  glyph: string;
  qCount: number;
};

const SECTIONS: Section[] = [
  { id: "start", accent: "#5eead4", glyph: "▶", qCount: 4 },
  { id: "send", accent: "#0ea5e9", glyph: "→", qCount: 5 },
  { id: "save", accent: "#fbbf24", glyph: "✦", qCount: 4 },
  { id: "credit", accent: "#a78bfa", glyph: "◯", qCount: 4 },
  { id: "power", accent: "#0d9488", glyph: "★", qCount: 4 },
  { id: "privacy", accent: "#f472b6", glyph: "⛨", qCount: 4 },
  { id: "trouble", accent: "#dc2626", glyph: "⚠", qCount: 4 },
];

export default function BankHelpPage() {
  const { t } = useI18n();
  const [query, setQuery] = useState("");

  const filteredSections = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SECTIONS.map((s) => ({ section: s, indices: rangeOf(s.qCount) }));
    return SECTIONS.map((s) => {
      const indices = rangeOf(s.qCount).filter((i) => {
        const qKey = `help.${s.id}.q${i + 1}`;
        const aKey = `help.${s.id}.a${i + 1}`;
        return (
          (t(qKey) ?? "").toLowerCase().includes(q) ||
          (t(aKey) ?? "").toLowerCase().includes(q)
        );
      });
      return { section: s, indices };
    }).filter(({ indices }) => indices.length > 0);
  }, [query, t]);

  const total = SECTIONS.reduce((s, x) => s + x.qCount, 0);
  const visible = filteredSections.reduce((s, x) => s + x.indices.length, 0);

  // FAQPage JSON-LD — surfaces all 25 Q/As to search engines so Google can
  // render them as a rich result on the SERP. Localised via the same t()
  // call that drives the visible UI, so the structured data tracks the
  // current language.
  const faqJsonLd = useMemo(() => {
    const mainEntity = SECTIONS.flatMap((s) =>
      Array.from({ length: s.qCount }, (_, i) => ({
        "@type": "Question",
        name: t(`help.${s.id}.q${i + 1}`),
        acceptedAnswer: {
          "@type": "Answer",
          text: t(`help.${s.id}.a${i + 1}`),
        },
      })),
    );
    return {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity,
    };
  }, [t]);

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 50% 0%, rgba(13,148,136,0.16), transparent 60%), linear-gradient(180deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)",
        color: "#f8fafc",
        padding: "32px 16px 56px",
      }}
    >
      <script
        type="application/ld+json"
        // Schema.org JSON-LD — safe insert with JSON.stringify; no user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
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
            {t("help.kicker")}
          </div>
          <h1
            style={{
              fontSize: 44,
              fontWeight: 900,
              letterSpacing: -1.2,
              lineHeight: 1.05,
              marginTop: 14,
              marginBottom: 8,
            }}
          >
            {t("help.headline")}
          </h1>
          <div style={{ fontSize: 15, color: "#cbd5e1", lineHeight: 1.55, maxWidth: 660 }}>
            {t("help.lede")}
          </div>
        </header>

        {/* Search */}
        <div style={{ marginBottom: 20 }}>
          <input
            type="search"
            placeholder={t("help.searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "12px 16px",
              borderRadius: 12,
              background: "rgba(15,23,42,0.55)",
              border: "1px solid rgba(255,255,255,0.10)",
              color: "#fff",
              fontSize: 14,
              outline: "none",
            }}
            aria-label={t("help.searchAria")}
          />
          <div style={{ marginTop: 6, fontSize: 11, color: "rgba(255,255,255,0.55)" }}>
            {visible === total
              ? t("help.searchHintAll", { count: total })
              : t("help.searchHintFiltered", { visible, total })}
          </div>
        </div>

        {/* Section nav */}
        {!query && (
          <nav
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 24,
            }}
            aria-label={t("help.tocAria")}
          >
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                style={{
                  padding: "8px 14px",
                  borderRadius: 999,
                  border: `1px solid ${s.accent}40`,
                  color: s.accent,
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
                <span aria-hidden>{s.glyph}</span>
                {t(`help.${s.id}.title`)}
              </a>
            ))}
          </nav>
        )}

        {filteredSections.length === 0 && (
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
            {t("help.noResults", { q: query })}
          </div>
        )}

        {filteredSections.map(({ section, indices }) => (
          <section key={section.id} id={section.id} style={{ marginBottom: 28, scrollMarginTop: 80 }}>
            <div style={{ marginBottom: 12 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: 4,
                  textTransform: "uppercase",
                  color: section.accent,
                }}
              >
                {section.glyph} · {t(`help.${section.id}.kicker`)}
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 900, margin: "4px 0 0 0", lineHeight: 1.2, letterSpacing: -0.4 }}>
                {t(`help.${section.id}.title`)}
              </h2>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {indices.map((i) => (
                <details
                  key={i}
                  style={{
                    padding: "14px 16px",
                    borderRadius: 12,
                    background: "rgba(15,23,42,0.55)",
                    border: `1px solid ${section.accent}1a`,
                    color: "#fff",
                  }}
                  open={Boolean(query)}
                >
                  <summary
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      cursor: "pointer",
                      listStyle: "none",
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <span>{t(`help.${section.id}.q${i + 1}`)}</span>
                    <span aria-hidden style={{ color: section.accent, fontWeight: 900 }}>+</span>
                  </summary>
                  <p style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6, margin: "10px 0 0 0" }}>
                    {t(`help.${section.id}.a${i + 1}`)}
                  </p>
                </details>
              ))}
            </div>
          </section>
        ))}

        {/* CTA */}
        <section
          style={{
            padding: 22,
            borderRadius: 16,
            background: "linear-gradient(135deg, rgba(13,148,136,0.18), rgba(99,102,241,0.10))",
            border: "1px solid rgba(94,234,212,0.30)",
            marginTop: 16,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: "#5eead4",
            }}
          >
            {t("help.cta.kicker")}
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, marginTop: 6, lineHeight: 1.25 }}>
            {t("help.cta.title")}
          </div>
          <div style={{ fontSize: 13, color: "#cbd5e1", marginTop: 8, lineHeight: 1.55 }}>
            {t("help.cta.body")}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            <Link
              href="/bank/security"
              style={ctaSecondary}
            >
              {t("help.cta.security")} →
            </Link>
            <Link
              href="/bank/trust"
              style={ctaSecondary}
            >
              {t("help.cta.trust")} →
            </Link>
            <Link
              href="/bank/about"
              style={ctaSecondary}
            >
              {t("help.cta.about")} →
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

function rangeOf(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

const ctaSecondary: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.04)",
  color: "#fff",
  fontSize: 12,
  fontWeight: 800,
  textDecoration: "none",
};
