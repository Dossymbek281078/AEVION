"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { InstallBanner } from "../_components/InstallBanner";
import { SubrouteFooter } from "../_components/SubrouteFooter";

type Layer = {
  key: string;
  accent: string;
  glyph: string;
};

const LAYERS: Layer[] = [
  { key: "device", accent: "#5eead4", glyph: "⌂" },
  { key: "qsign", accent: "#a78bfa", glyph: "✓" },
  { key: "biometric", accent: "#f472b6", glyph: "ⓤ" },
  { key: "anomaly", accent: "#fbbf24", glyph: "⚠" },
  { key: "export", accent: "#0ea5e9", glyph: "↓" },
];

const COMPARISONS: Array<{ key: "device" | "credit" | "audit"; trad: string; aevion: string }> = [
  { key: "device", trad: "security.compare.device.trad", aevion: "security.compare.device.aevion" },
  { key: "credit", trad: "security.compare.credit.trad", aevion: "security.compare.credit.aevion" },
  { key: "audit", trad: "security.compare.audit.trad", aevion: "security.compare.audit.aevion" },
];

const FAQ_KEYS = ["1", "2", "3", "4", "5"];

export default function BankSecurityPage() {
  const { t } = useI18n();
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
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <Link
          href="/bank"
          style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", textDecoration: "none", fontWeight: 700 }}
        >
          ← {t("about.backToBank")}
        </Link>

        <header style={{ marginTop: 18, marginBottom: 28 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 6,
              color: "#5eead4",
              textTransform: "uppercase",
            }}
          >
            {t("security.kicker")}
          </div>
          <h1
            style={{
              fontSize: 44,
              fontWeight: 900,
              letterSpacing: -1.2,
              lineHeight: 1.05,
              marginTop: 14,
              marginBottom: 10,
            }}
          >
            {t("security.headline")}
          </h1>
          <div style={{ fontSize: 16, color: "#cbd5e1", lineHeight: 1.55, maxWidth: 660 }}>
            {t("security.lede")}
          </div>
        </header>

        {/* Layer cards */}
        <SectionTitle kicker={t("security.layers.kicker")} title={t("security.layers.title")} />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
            marginBottom: 32,
          }}
        >
          {LAYERS.map((l) => (
            <div
              key={l.key}
              style={{
                padding: 18,
                borderRadius: 14,
                background: "rgba(15,23,42,0.55)",
                border: "1px solid rgba(255,255,255,0.06)",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: `${l.accent}22`,
                  border: `1px solid ${l.accent}44`,
                  color: l.accent,
                  fontSize: 18,
                  fontWeight: 900,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {l.glyph}
              </div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: 3,
                  textTransform: "uppercase",
                  color: l.accent,
                }}
              >
                {t(`security.layer.${l.key}.kicker`)}
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", lineHeight: 1.25 }}>
                {t(`security.layer.${l.key}.title`)}
              </div>
              <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.55 }}>
                {t(`security.layer.${l.key}.body`)}
              </div>
            </div>
          ))}
        </div>

        {/* What we do NOT do */}
        <SectionTitle
          kicker={t("security.notDo.kicker")}
          title={t("security.notDo.title")}
          accent="#fbbf24"
        />
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: "0 0 32px 0",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 8,
          }}
        >
          {["1", "2", "3", "4"].map((n) => (
            <li
              key={n}
              style={{
                padding: "14px 16px",
                borderRadius: 12,
                background: "rgba(251,191,36,0.06)",
                border: "1px solid rgba(251,191,36,0.18)",
                fontSize: 13,
                color: "#fde68a",
                lineHeight: 1.5,
                display: "flex",
                gap: 10,
              }}
            >
              <span style={{ color: "#fbbf24", fontWeight: 900 }}>×</span>
              <span>{t(`security.notDo.item${n}`)}</span>
            </li>
          ))}
        </ul>

        {/* Comparisons */}
        <SectionTitle
          kicker={t("security.compare.kicker")}
          title={t("security.compare.title")}
          accent="#a78bfa"
        />
        <div
          style={{
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 14,
            overflow: "hidden",
            marginBottom: 32,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 3,
              textTransform: "uppercase",
              background: "rgba(15,23,42,0.85)",
            }}
          >
            <div style={{ padding: 12, color: "rgba(255,255,255,0.55)" }}>{t("security.compare.headerTrad")}</div>
            <div style={{ padding: 12, color: "#a78bfa", borderLeft: "1px solid rgba(255,255,255,0.08)" }}>
              {t("security.compare.headerAevion")}
            </div>
          </div>
          {COMPARISONS.map((c, i) => (
            <div
              key={c.key}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                background: i % 2 === 0 ? "rgba(15,23,42,0.45)" : "rgba(15,23,42,0.30)",
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              <div style={{ padding: 14, color: "#cbd5e1" }}>{t(c.trad)}</div>
              <div
                style={{
                  padding: 14,
                  color: "#fff",
                  borderLeft: "1px solid rgba(255,255,255,0.08)",
                  fontWeight: 600,
                }}
              >
                {t(c.aevion)}
              </div>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <SectionTitle
          kicker={t("security.faq.kicker")}
          title={t("security.faq.title")}
          accent="#f472b6"
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 32 }}>
          {FAQ_KEYS.map((k) => (
            <details
              key={k}
              style={{
                padding: "14px 16px",
                borderRadius: 12,
                background: "rgba(15,23,42,0.55)",
                border: "1px solid rgba(255,255,255,0.06)",
                color: "#fff",
              }}
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
                <span>{t(`security.faq.q${k}`)}</span>
                <span aria-hidden style={{ color: "#f472b6", fontWeight: 900 }}>+</span>
              </summary>
              <p style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6, margin: "10px 0 0 0" }}>
                {t(`security.faq.a${k}`)}
              </p>
            </details>
          ))}
        </div>

        {/* CTA */}
        <section
          style={{
            padding: 24,
            borderRadius: 18,
            background: "linear-gradient(135deg, rgba(13,148,136,0.18), rgba(99,102,241,0.10))",
            border: "1px solid rgba(94,234,212,0.30)",
            marginBottom: 16,
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
            {t("security.cta.kicker")}
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, marginTop: 6, lineHeight: 1.25 }}>
            {t("security.cta.title")}
          </div>
          <div style={{ fontSize: 14, color: "#cbd5e1", marginTop: 8, lineHeight: 1.55 }}>
            {t("security.cta.body")}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
            <Link
              href="/bank"
              style={ctaPrimary}
            >
              {t("about.cta.openBank")}
            </Link>
            <Link
              href="/bank/about"
              style={ctaSecondary}
            >
              {t("trust.page.cta.aboutLink")}
            </Link>
            <Link
              href="/bank/trust"
              style={ctaSecondary}
            >
              {t("card.action.score")}
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

function SectionTitle({
  kicker,
  title,
  accent,
}: {
  kicker: string;
  title: string;
  accent?: string;
}) {
  return (
    <div style={{ marginTop: 8, marginBottom: 14 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: 4,
          textTransform: "uppercase",
          color: accent ?? "#5eead4",
        }}
      >
        {kicker}
      </div>
      <h2
        style={{
          fontSize: 24,
          fontWeight: 900,
          margin: "4px 0 0 0",
          lineHeight: 1.2,
          letterSpacing: -0.4,
        }}
      >
        {title}
      </h2>
    </div>
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
