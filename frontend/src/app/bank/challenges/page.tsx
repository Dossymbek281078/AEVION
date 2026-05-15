"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { InstallBanner } from "../_components/InstallBanner";
import { SpendingChallenges } from "../_components/SpendingChallenges";
import { SubrouteFooter } from "../_components/SubrouteFooter";
import { CurrencyProvider } from "../_lib/CurrencyContext";
import { listAccounts, listOperations } from "../_lib/api";
import type { Account, Operation } from "../_lib/types";

function ChallengesInner() {
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
          "radial-gradient(circle at 25% 0%, rgba(220,38,38,0.18), transparent 55%), linear-gradient(180deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)",
        color: "#f8fafc",
        padding: "32px 16px 56px",
      }}
    >
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <Link href="/bank" style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", textDecoration: "none", fontWeight: 700 }}>
          {`← ${t("about.backToBank")}`}
        </Link>
        <header style={{ marginTop: 18, marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 6, color: "#f87171", textTransform: "uppercase" }}>
            {t("challengesPage.kicker")}
          </div>
          <h1 style={{ fontSize: 40, fontWeight: 900, letterSpacing: -1.2, lineHeight: 1.05, marginTop: 14, marginBottom: 8 }}>
            {t("challengesPage.headline")}
          </h1>
          <div style={{ fontSize: 15, color: "#cbd5e1", lineHeight: 1.55, maxWidth: 640 }}>
            {t("challengesPage.lede")}
          </div>
        </header>

        <div style={{ background: "#fff", color: "#0f172a", borderRadius: 16, padding: 4, marginBottom: 18 }}>
          <SpendingChallenges myAccountId={myAccount?.id ?? ""} operations={operations} />
        </div>

        <section
          style={{
            padding: 22,
            borderRadius: 16,
            background: "linear-gradient(135deg, rgba(220,38,38,0.16), rgba(99,102,241,0.10))",
            border: "1px solid rgba(248,113,113,0.30)",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 4, color: "#f87171", textTransform: "uppercase" }}>
            {t("challengesPage.cta.kicker")}
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, marginTop: 6, lineHeight: 1.25 }}>{t("challengesPage.cta.title")}</div>
          <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            <Link href="/bank/achievements" style={ctaPrimary}>{t("challengesPage.cta.achievements")} →</Link>
            <Link href="/bank/budget" style={ctaSecondary}>{t("challengesPage.cta.budget")} →</Link>
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
  background: "linear-gradient(135deg, #f87171, #db2777)",
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

export default function ChallengesPage() {
  return (
    <CurrencyProvider>
      <ChallengesInner />
    </CurrencyProvider>
  );
}
