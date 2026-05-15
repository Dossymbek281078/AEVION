"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { SubrouteFooter } from "../_components/SubrouteFooter";

// Story-grade landing for AEVION Bank. Single-scroll page that explains
// what's actually different — no dashboard, no live data. Indexable.
// Investor-first audience; users who want to use the bank go to /bank.

export default function BankAboutPage() {
  const { t } = useI18n();
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)",
        color: "#f8fafc",
        padding: "32px 16px 56px",
      }}
    >
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <Link
          href="/bank"
          style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", textDecoration: "none", fontWeight: 700 }}
        >
          ← {t("about.backToBank")}
        </Link>

        <header style={{ marginTop: 18, marginBottom: 32 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 6,
              color: "#5eead4",
              textTransform: "uppercase",
            }}
          >
            AEVION · Bank
          </div>
          <h1
            style={{
              fontSize: 48,
              fontWeight: 900,
              letterSpacing: -1.5,
              lineHeight: 1.05,
              marginTop: 14,
              marginBottom: 0,
            }}
          >
            {t("about.headline")}
          </h1>
          <div style={{ fontSize: 18, color: "#cbd5e1", marginTop: 16, lineHeight: 1.5, maxWidth: 640 }}>
            {t("about.lede")}
          </div>
        </header>

        <Section
          kicker={t("about.s1.kicker")}
          title={t("about.s1.title")}
          body={t("about.s1.body")}
          accent="#5eead4"
        />

        <Section
          kicker={t("about.s2.kicker")}
          title={t("about.s2.title")}
          body={t("about.s2.body")}
          accent="#fbbf24"
        />

        <Section
          kicker={t("about.s3.kicker")}
          title={t("about.s3.title")}
          body={t("about.s3.body")}
          accent="#a78bfa"
        />

        <Section
          kicker={t("about.s4.kicker")}
          title={t("about.s4.title")}
          body={t("about.s4.body")}
          accent="#f472b6"
        />

        <section
          style={{
            marginTop: 32,
            padding: 24,
            borderRadius: 18,
            background: "linear-gradient(135deg, rgba(13,148,136,0.18), rgba(99,102,241,0.10))",
            border: "1px solid rgba(94,234,212,0.30)",
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
            {t("about.cta.kicker")}
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, marginTop: 6, lineHeight: 1.25 }}>
            {t("about.cta.title")}
          </div>
          <div style={{ fontSize: 14, color: "#cbd5e1", marginTop: 8, lineHeight: 1.55 }}>
            {t("about.cta.body")}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
            <Link
              href="/bank"
              style={{
                padding: "12px 20px",
                borderRadius: 12,
                background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
                color: "#fff",
                fontSize: 13,
                fontWeight: 800,
                textDecoration: "none",
              }}
            >
              {t("about.cta.openBank")}
            </Link>
            <Link
              href="/bank/explore"
              style={{
                padding: "12px 20px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.18)",
                background: "rgba(255,255,255,0.04)",
                color: "#fff",
                fontSize: 13,
                fontWeight: 800,
                textDecoration: "none",
              }}
            >
              {t("about.cta.exploreSurfaces")}
            </Link>
            <Link
              href="/pitch"
              style={{
                padding: "12px 20px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.10)",
                background: "transparent",
                color: "#cbd5e1",
                fontSize: 13,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              {t("about.cta.investorPitch")} →
            </Link>
          </div>
        </section>

        <div style={{ marginTop: 24 }}>
          <SubrouteFooter />
        </div>
      </div>
    </main>
  );
}

function Section({
  kicker,
  title,
  body,
  accent,
}: {
  kicker: string;
  title: string;
  body: string;
  accent: string;
}) {
  return (
    <section style={{ marginBottom: 28 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: 4,
          textTransform: "uppercase",
          color: accent,
        }}
      >
        {kicker}
      </div>
      <h2
        style={{
          fontSize: 28,
          fontWeight: 900,
          margin: "6px 0 12px 0",
          lineHeight: 1.15,
          letterSpacing: -0.5,
        }}
      >
        {title}
      </h2>
      <p style={{ fontSize: 16, color: "#cbd5e1", lineHeight: 1.6, margin: 0, maxWidth: 640 }}>
        {body}
      </p>
    </section>
  );
}
