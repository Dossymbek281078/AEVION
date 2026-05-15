"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { InstallBanner } from "../_components/InstallBanner";
import { SubrouteFooter } from "../_components/SubrouteFooter";
import { WealthForecast } from "../_components/WealthForecast";
import { CurrencyProvider } from "../_lib/CurrencyContext";
import { EcosystemDataProvider } from "../_lib/EcosystemDataContext";
import { listAccounts, listOperations } from "../_lib/api";
import type { Account, Operation } from "../_lib/types";

function ForecastInner() {
  const { t } = useI18n();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [a, o] = await Promise.all([listAccounts(), listOperations()]);
        if (cancelled) return;
        setAccounts(a);
        setOperations(o);
      } catch {
        // offline ok — forecast will simply have no ecosystem data
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const myAccount = accounts[0] ?? null;

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 80% 0%, rgba(94,234,212,0.18), transparent 55%), linear-gradient(180deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)",
        color: "#f8fafc",
        padding: "32px 16px 56px",
      }}
    >
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <Link
          href="/bank"
          style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", textDecoration: "none", fontWeight: 700 }}
        >
          {`← ${t("about.backToBank")}`}
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
            {t("forecastPage.kicker")}
          </div>
          <h1
            style={{
              fontSize: 40,
              fontWeight: 900,
              letterSpacing: -1.2,
              lineHeight: 1.05,
              marginTop: 14,
              marginBottom: 8,
            }}
          >
            {t("forecastPage.headline")}
          </h1>
          <div style={{ fontSize: 15, color: "#cbd5e1", lineHeight: 1.55, maxWidth: 640 }}>
            {t("forecastPage.lede")}
          </div>
        </header>

        {/* Loading / no-account state */}
        {loaded && !myAccount && (
          <div
            style={{
              padding: 28,
              borderRadius: 16,
              background: "rgba(15,23,42,0.55)",
              border: "1px dashed rgba(94,234,212,0.30)",
              textAlign: "center",
              color: "#cbd5e1",
              marginBottom: 24,
            }}
          >
            <div aria-hidden style={{ fontSize: 42, color: "#5eead4", marginBottom: 10, lineHeight: 1 }}>
              ◇
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 6 }}>
              {t("forecastPage.empty.title")}
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6, maxWidth: 460, margin: "0 auto" }}>
              {t("forecastPage.empty.body")}
            </div>
            <div style={{ marginTop: 16 }}>
              <Link
                href="/bank"
                style={{
                  padding: "10px 18px",
                  borderRadius: 10,
                  background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 800,
                  textDecoration: "none",
                  display: "inline-block",
                }}
              >
                {t("about.cta.openBank")} →
              </Link>
            </div>
          </div>
        )}

        {/* Forecast on white surface */}
        {myAccount && (
          <EcosystemDataProvider accountId={myAccount.id} operations={operations}>
            <div style={{ background: "#fff", color: "#0f172a", borderRadius: 16, padding: 4, marginBottom: 18 }}>
              <WealthForecast account={myAccount} />
            </div>
          </EcosystemDataProvider>
        )}

        {/* Methodology footnote */}
        <section
          style={{
            padding: 18,
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(15,23,42,0.55)",
            marginBottom: 18,
            fontSize: 12,
            color: "rgba(255,255,255,0.65)",
            lineHeight: 1.6,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 3, color: "#5eead4", textTransform: "uppercase", marginBottom: 6 }}>
            {t("forecastPage.method.kicker")}
          </div>
          {t("forecastPage.method.body")}
        </section>

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
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 4,
              color: "#5eead4",
              textTransform: "uppercase",
            }}
          >
            {t("forecastPage.cta.kicker")}
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, marginTop: 6, lineHeight: 1.25 }}>
            {t("forecastPage.cta.title")}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            <Link
              href="/bank/savings"
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
              {t("forecastPage.cta.savings")} →
            </Link>
            <Link
              href="/bank/budget"
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
              {t("forecastPage.cta.budget")} →
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

export default function ForecastPage() {
  return (
    <CurrencyProvider>
      <ForecastInner />
    </CurrencyProvider>
  );
}
