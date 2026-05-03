"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { CurrencySwitcher } from "./Money";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { QuickDemoControls } from "./QuickDemoControls";

export function BankHero({ email, extra }: { email?: string; extra?: ReactNode }) {
  const { t } = useI18n();
  return (
    <div
      style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 40%, #4c1d95 100%)",
        padding: "32px 28px 28px",
        color: "#fff",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          marginBottom: 14,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div
            style={{
              display: "inline-block",
              padding: "4px 12px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase" as const,
              border: "1px solid rgba(255,255,255,0.2)",
              background: "rgba(255,255,255,0.08)",
            }}
          >
            {t("hero.badge")}
          </div>
          <Link
            href="/bank/changelog"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "4px 11px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.05em",
              border: "1px solid rgba(94,234,212,0.40)",
              background: "rgba(94,234,212,0.10)",
              color: "#5eead4",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            <span aria-hidden>★</span>
            {t("hero.whatsNew")}
          </Link>
        </div>
        <LanguageSwitcher variant="hero" />
      </div>
      <h1 style={{ fontSize: 28, fontWeight: 900, margin: "0 0 8px", letterSpacing: "-0.03em" }}>
        {t("hero.title")}
      </h1>
      <p style={{ margin: 0, fontSize: 15, opacity: 0.88, lineHeight: 1.6, maxWidth: 600 }}>
        {t("hero.subtitle")}
      </p>
      <div style={{ marginTop: 14 }}>
        <QuickDemoControls />
      </div>
      {email ? (
        <div
          style={{
            marginTop: 14,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
            fontSize: 12,
            opacity: 0.95,
          }}
        >
          <span style={{ opacity: 0.75 }}>
            {t("hero.signedIn")} <strong>{email}</strong>
          </span>
          <CurrencySwitcher />
        </div>
      ) : null}
      {extra ? <div style={{ marginTop: 14 }}>{extra}</div> : null}
    </div>
  );
}
