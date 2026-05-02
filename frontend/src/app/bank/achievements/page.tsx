"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { AchievementsPanel } from "../_components/AchievementsPanel";
import { InstallBanner } from "../_components/InstallBanner";
import { SubrouteFooter } from "../_components/SubrouteFooter";
import { CurrencyProvider } from "../_lib/CurrencyContext";
import { listAccounts, listOperations } from "../_lib/api";
import type { Account, Operation } from "../_lib/types";

function AchievementsInner() {
  const { t } = useI18n();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [operations, setOperations] = useState<Operation[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [a, o] = await Promise.all([listAccounts(), listOperations()]);
        if (cancelled) return;
        setAccounts(a);
        setOperations(o);
      } catch {
        // offline
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
          "radial-gradient(circle at 80% 0%, rgba(251,191,36,0.18), transparent 55%), linear-gradient(180deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)",
        color: "#f8fafc",
        padding: "32px 16px 56px",
      }}
    >
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <Link href="/bank" style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", textDecoration: "none", fontWeight: 700 }}>
          {`← ${t("about.backToBank")}`}
        </Link>
        <header style={{ marginTop: 18, marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 6, color: "#fbbf24", textTransform: "uppercase" }}>
            {t("achievementsPage.kicker")}
          </div>
          <h1 style={{ fontSize: 40, fontWeight: 900, letterSpacing: -1.2, lineHeight: 1.05, marginTop: 14, marginBottom: 8 }}>
            {t("achievementsPage.headline")}
          </h1>
          <div style={{ fontSize: 15, color: "#cbd5e1", lineHeight: 1.55, maxWidth: 640 }}>
            {t("achievementsPage.lede")}
          </div>
        </header>

        {myAccount ? (
          <div style={{ background: "#fff", color: "#0f172a", borderRadius: 16, padding: 4, marginBottom: 18 }}>
            <AchievementsPanel account={myAccount} operations={operations} />
          </div>
        ) : (
          <div
            style={{
              padding: 28,
              borderRadius: 16,
              background: "rgba(15,23,42,0.55)",
              border: "1px dashed rgba(251,191,36,0.30)",
              textAlign: "center",
              color: "#cbd5e1",
              marginBottom: 18,
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 6 }}>{t("achievementsPage.empty.title")}</div>
            <div style={{ fontSize: 13, lineHeight: 1.6, maxWidth: 460, margin: "0 auto" }}>{t("achievementsPage.empty.body")}</div>
          </div>
        )}

        <section
          style={{
            padding: 22,
            borderRadius: 16,
            background: "linear-gradient(135deg, rgba(251,191,36,0.18), rgba(13,148,136,0.10))",
            border: "1px solid rgba(251,191,36,0.30)",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 4, color: "#fbbf24", textTransform: "uppercase" }}>
            {t("achievementsPage.cta.kicker")}
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, marginTop: 6, lineHeight: 1.25 }}>{t("achievementsPage.cta.title")}</div>
          <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            <Link href="/bank/challenges" style={ctaPrimary}>{t("achievementsPage.cta.challenges")} →</Link>
            <Link href="/bank/leaderboard" style={ctaSecondary}>{t("achievementsPage.cta.leaderboard")} →</Link>
          </div>
        </section>

        <div style={{ marginTop: 16 }}><InstallBanner /></div>
        <div style={{ marginTop: 16 }}><SubrouteFooter /></div>
      </div>
    </main>
  );
}

const ctaPrimary: React.CSSProperties = {
  padding: "12px 20px",
  borderRadius: 12,
  background: "linear-gradient(135deg, #fbbf24, #d97706)",
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

export default function AchievementsPage() {
  return (
    <CurrencyProvider>
      <AchievementsInner />
    </CurrencyProvider>
  );
}
