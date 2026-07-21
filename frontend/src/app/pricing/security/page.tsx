import Link from "next/link";
import { ProductPageShell } from "@/components/ProductPageShell";
import { getServerT } from "@/lib/i18n-server";

const CARD = "0 4px 20px rgba(15,23,42,0.06)";
const BORDER = "1px solid rgba(15,23,42,0.08)";

const CERTIFICATIONS = [
  {
    name: "SOC 2 Type II",
    scopeKey: "pricing.security.cert.soc2.scope",
    statusKey: "pricing.security.cert.soc2.status",
    color: "#0d9488",
    bg: "#ecfdf5",
    icon: "✓",
  },
  {
    name: "GDPR",
    scopeKey: "pricing.security.cert.gdpr.scope",
    statusKey: "pricing.security.cert.gdpr.status",
    color: "#0ea5e9",
    bg: "#e0f2fe",
    icon: "✓",
  },
  {
    name: "152-ФЗ",
    scopeKey: "pricing.security.cert.fz152.scope",
    statusKey: "pricing.security.cert.fz152.status",
    color: "#7c3aed",
    bg: "#f5f3ff",
    icon: "✓",
  },
  {
    name: "PCI DSS",
    scopeKey: "pricing.security.cert.pcidss.scope",
    statusKey: "pricing.security.cert.pcidss.status",
    color: "#d97706",
    bg: "#fefce8",
    icon: "✓",
  },
];

const PILLARS = [
  {
    titleKey: "pricing.security.pillar.encryption.title",
    icon: "🔒",
    bodyKey: "pricing.security.pillar.encryption.body",
  },
  {
    titleKey: "pricing.security.pillar.access.title",
    icon: "👤",
    bodyKey: "pricing.security.pillar.access.body",
  },
  {
    titleKey: "pricing.security.pillar.audit.title",
    icon: "📋",
    bodyKey: "pricing.security.pillar.audit.body",
  },
  {
    titleKey: "pricing.security.pillar.infra.title",
    icon: "🏗",
    bodyKey: "pricing.security.pillar.infra.body",
  },
  {
    titleKey: "pricing.security.pillar.bcp.title",
    icon: "♻",
    bodyKey: "pricing.security.pillar.bcp.body",
  },
  {
    titleKey: "pricing.security.pillar.secdev.title",
    icon: "🛡",
    bodyKey: "pricing.security.pillar.secdev.body",
  },
];

const RESIDENCY_ROWS = [
  {
    region: "EU (Frankfurt)",
    flag: "🇪🇺",
    tiersKey: "pricing.security.residency.eu.tiers",
    primary: true,
    notesKey: "pricing.security.residency.eu.notes",
  },
  {
    regionKey: "pricing.security.residency.ru.region",
    flag: "🇷🇺",
    tiersKey: "pricing.security.residency.ru.tiers",
    primary: false,
    notesKey: "pricing.security.residency.ru.notes",
  },
  {
    regionKey: "pricing.security.residency.kz.region",
    flag: "🇰🇿",
    tiersKey: "pricing.security.residency.kz.tiers",
    primary: false,
    notesKey: "pricing.security.residency.kz.notes",
  },
  {
    region: "Your VPC",
    flag: "🏢",
    tiersKey: "pricing.security.residency.vpc.tiers",
    primary: false,
    notesKey: "pricing.security.residency.vpc.notes",
  },
];

const DOC_CARDS = [
  {
    titleKey: "pricing.security.doc.soc2.title",
    descriptionKey: "pricing.security.doc.soc2.description",
    ctaKey: "pricing.security.doc.soc2.cta",
    href: "/pricing/contact?topic=soc2",
    accent: "#0d9488",
  },
  {
    titleKey: "pricing.security.doc.dpa.title",
    descriptionKey: "pricing.security.doc.dpa.description",
    ctaKey: "pricing.security.doc.dpa.cta",
    href: "/pricing/contact?topic=dpa",
    accent: "#0ea5e9",
  },
  {
    titleKey: "pricing.security.doc.pentest.title",
    descriptionKey: "pricing.security.doc.pentest.description",
    ctaKey: "pricing.security.doc.pentest.cta",
    href: "/pricing/contact?topic=pentest",
    accent: "#7c3aed",
  },
];

export default async function SecurityPage() {
  const { t } = await getServerT();
  return (
    <ProductPageShell maxWidth={1100}>
      {/* Back link */}
      <div style={{ marginBottom: 16 }}>
        <Link href="/pricing" style={{ color: "#64748b", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
          ← {t("pricing.security.backLink")}
        </Link>
      </div>

      {/* Hero */}
      <section style={{ textAlign: "center", padding: "32px 0 28px" }}>
        <div
          style={{
            display: "inline-block",
            padding: "4px 12px",
            background: "linear-gradient(135deg, #065f46, #0d9488)",
            color: "#fff",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.06em",
            borderRadius: 999,
            marginBottom: 16,
          }}
        >
          SECURITY &amp; COMPLIANCE
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
          {t("pricing.security.hero.title")}
        </h1>
        <p
          style={{
            fontSize: 15,
            color: "#475569",
            maxWidth: 660,
            margin: "0 auto",
            lineHeight: 1.6,
          }}
        >
          {t("pricing.security.hero.body")}
        </p>
      </section>

      {/* Certifications row */}
      <section style={{ marginBottom: 56 }}>
        <h2
          style={{
            fontSize: 22,
            fontWeight: 900,
            margin: 0,
            marginBottom: 20,
            letterSpacing: "-0.02em",
            textAlign: "center",
            color: "#0f172a",
          }}
        >
          {t("pricing.security.certifications.heading")}
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 14,
          }}
        >
          {CERTIFICATIONS.map((cert) => (
            <div
              key={cert.name}
              style={{
                background: cert.bg,
                border: `1px solid ${cert.color}30`,
                borderRadius: 14,
                padding: "20px 18px",
                textAlign: "center",
                boxShadow: CARD,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: cert.color,
                  color: "#fff",
                  fontSize: 18,
                  fontWeight: 900,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 12px",
                }}
              >
                {cert.icon}
              </div>
              <div style={{ fontSize: 18, fontWeight: 900, color: cert.color, marginBottom: 4 }}>
                {cert.name}
              </div>
              <div
                style={{
                  display: "inline-block",
                  padding: "2px 8px",
                  background: cert.color,
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: 800,
                  borderRadius: 999,
                  letterSpacing: "0.06em",
                  marginBottom: 8,
                }}
              >
                {t(cert.statusKey)}
              </div>
              <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.4 }}>{t(cert.scopeKey)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Security pillars */}
      <section style={{ marginBottom: 56 }}>
        <h2
          style={{
            fontSize: 26,
            fontWeight: 900,
            margin: 0,
            marginBottom: 6,
            letterSpacing: "-0.02em",
            color: "#0f172a",
          }}
        >
          {t("pricing.security.pillars.heading")}
        </h2>
        <p style={{ color: "#64748b", margin: 0, marginBottom: 24, fontSize: 14 }}>
          {t("pricing.security.pillars.subheading")}
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 14,
          }}
        >
          {PILLARS.map((pillar) => (
            <div
              key={pillar.titleKey}
              style={{
                background: "#fff",
                border: BORDER,
                borderRadius: 14,
                padding: "20px 18px",
                boxShadow: CARD,
              }}
            >
              <div style={{ fontSize: 24, marginBottom: 10 }}>{pillar.icon}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>
                {t(pillar.titleKey)}
              </div>
              <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.6 }}>{t(pillar.bodyKey)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Data residency table */}
      <section style={{ marginBottom: 56 }}>
        <h2
          style={{
            fontSize: 26,
            fontWeight: 900,
            margin: 0,
            marginBottom: 6,
            letterSpacing: "-0.02em",
            color: "#0f172a",
          }}
        >
          {t("pricing.security.residency.heading")}
        </h2>
        <p style={{ color: "#64748b", margin: 0, marginBottom: 20, fontSize: 14 }}>
          {t("pricing.security.residency.subheading")}
        </p>
        <div
          style={{
            background: "#fff",
            border: BORDER,
            borderRadius: 14,
            overflow: "hidden",
            boxShadow: CARD,
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 800, color: "#475569" }}>
                    {t("pricing.security.residency.table.region")}
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 800, color: "#475569" }}>
                    {t("pricing.security.residency.table.tiers")}
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 800, color: "#475569" }}>
                    {t("pricing.security.residency.table.notes")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {RESIDENCY_ROWS.map((row, i) => (
                  <tr
                    key={"region" in row ? row.region : row.regionKey}
                    style={{
                      borderTop: i === 0 ? "none" : "1px solid rgba(15,23,42,0.05)",
                      background: row.primary ? "rgba(13,148,136,0.03)" : "transparent",
                    }}
                  >
                    <td style={{ padding: "12px 16px", fontWeight: 700, whiteSpace: "nowrap" }}>
                      <span style={{ marginRight: 8 }}>{row.flag}</span>
                      {"region" in row ? row.region : t(row.regionKey)}
                      {row.primary && (
                        <span
                          style={{
                            marginLeft: 8,
                            fontSize: 9,
                            fontWeight: 800,
                            padding: "2px 6px",
                            background: "#0d9488",
                            color: "#fff",
                            borderRadius: 4,
                            letterSpacing: "0.04em",
                          }}
                        >
                          DEFAULT
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px", color: "#475569" }}>{t(row.tiersKey)}</td>
                    <td style={{ padding: "12px 16px", color: "#64748b" }}>{t(row.notesKey)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Bug bounty CTA */}
      <section
        style={{
          marginBottom: 56,
          padding: 32,
          background: "linear-gradient(135deg, #0f172a, #1e293b)",
          borderRadius: 16,
          color: "#f8fafc",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div>
          <div
            style={{
              display: "inline-block",
              padding: "3px 10px",
              background: "rgba(245,158,11,0.18)",
              border: "1px solid rgba(245,158,11,0.4)",
              color: "#fbbf24",
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.08em",
              borderRadius: 6,
              marginBottom: 10,
            }}
          >
            BUG BOUNTY
          </div>
          <h2
            style={{
              fontSize: 24,
              fontWeight: 900,
              margin: 0,
              marginBottom: 8,
              letterSpacing: "-0.02em",
            }}
          >
            {t("pricing.security.bugBounty.title")}
          </h2>
          <p style={{ color: "#94a3b8", margin: 0, fontSize: 14, lineHeight: 1.6, maxWidth: 640 }}>
            {t("pricing.security.bugBounty.body")}
          </p>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link
            href="/pricing/contact?topic=bug-bounty"
            style={{
              display: "inline-block",
              padding: "12px 24px",
              background: "linear-gradient(135deg, #d97706, #f59e0b)",
              color: "#fff",
              borderRadius: 10,
              textDecoration: "none",
              fontWeight: 800,
              fontSize: 14,
            }}
          >
            {t("pricing.security.bugBounty.reportCta")}
          </Link>
          <a
            href="mailto:security@aevion.io"
            style={{
              display: "inline-block",
              padding: "12px 24px",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#cbd5e1",
              borderRadius: 10,
              textDecoration: "none",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            security@aevion.io
          </a>
        </div>
      </section>

      {/* Security document request cards */}
      <section style={{ marginBottom: 40 }}>
        <h2
          style={{
            fontSize: 26,
            fontWeight: 900,
            margin: 0,
            marginBottom: 6,
            letterSpacing: "-0.02em",
            color: "#0f172a",
          }}
        >
          {t("pricing.security.docs.heading")}
        </h2>
        <p style={{ color: "#64748b", margin: 0, marginBottom: 20, fontSize: 14 }}>
          {t("pricing.security.docs.subheading")}
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 14,
          }}
        >
          {DOC_CARDS.map((doc) => (
            <div
              key={doc.titleKey}
              style={{
                background: "#fff",
                border: BORDER,
                borderRadius: 14,
                padding: "20px 18px",
                boxShadow: CARD,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: doc.accent,
                  marginBottom: 2,
                }}
              />
              <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>{t(doc.titleKey)}</div>
              <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.5, flex: 1 }}>
                {t(doc.descriptionKey)}
              </div>
              <Link
                href={doc.href}
                style={{
                  display: "inline-block",
                  padding: "9px 16px",
                  background: doc.accent,
                  color: "#fff",
                  borderRadius: 8,
                  textDecoration: "none",
                  fontWeight: 700,
                  fontSize: 13,
                  alignSelf: "flex-start",
                }}
              >
                {t(doc.ctaKey)}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Back to pricing */}
      <div
        style={{
          borderTop: "1px solid rgba(15,23,42,0.08)",
          paddingTop: 24,
          marginTop: 8,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <Link href="/pricing" style={{ color: "#0d9488", fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
          ← {t("pricing.security.backToPricing")}
        </Link>
        <div style={{ fontSize: 12, color: "#94a3b8" }}>
          {t("pricing.security.questions")}{" "}
          <a href="mailto:security@aevion.io" style={{ color: "#0d9488", fontWeight: 700 }}>
            security@aevion.io
          </a>
        </div>
      </div>
    </ProductPageShell>
  );
}
