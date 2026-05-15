"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { InstallBanner } from "../_components/InstallBanner";
import { LoyaltyVaultPanel } from "../_components/LoyaltyVaultPanel";
import { SubrouteFooter } from "../_components/SubrouteFooter";
import { CurrencyProvider } from "../_lib/CurrencyContext";

function LoyaltyInner() {
  const { t } = useI18n();
  const [toastMsg, setToastMsg] = useState("");
  const [toastType, setToastType] = useState<"success" | "error" | "info">("info");

  const notify = useCallback((msg: string, type: "success" | "error" | "info" = "info") => {
    setToastMsg(msg);
    setToastType(type);
    const tid = setTimeout(() => setToastMsg(""), 3500);
    return () => clearTimeout(tid);
  }, []);

  const toastColor = toastType === "success" ? "#0d9488" : toastType === "error" ? "#dc2626" : "#6366f1";

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 75% 0%, rgba(14,165,233,0.18), transparent 55%), linear-gradient(180deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)",
        color: "#f8fafc",
        padding: "32px 16px 56px",
      }}
    >
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <Link href="/bank" style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", textDecoration: "none", fontWeight: 700 }}>
          {`← ${t("about.backToBank")}`}
        </Link>
        <header style={{ marginTop: 18, marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 6, color: "#0ea5e9", textTransform: "uppercase" }}>
            {t("loyaltyPage.kicker")}
          </div>
          <h1 style={{ fontSize: 40, fontWeight: 900, letterSpacing: -1.2, lineHeight: 1.05, marginTop: 14, marginBottom: 8 }}>
            {t("loyaltyPage.headline")}
          </h1>
          <div style={{ fontSize: 15, color: "#cbd5e1", lineHeight: 1.55, maxWidth: 640 }}>{t("loyaltyPage.lede")}</div>
        </header>

        <div style={{ background: "#fff", color: "#0f172a", borderRadius: 16, padding: 4, marginBottom: 18 }}>
          <LoyaltyVaultPanel notify={notify} />
        </div>

        <section
          style={{
            padding: 22,
            borderRadius: 16,
            background: "linear-gradient(135deg, rgba(14,165,233,0.18), rgba(99,102,241,0.10))",
            border: "1px solid rgba(14,165,233,0.30)",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 4, color: "#0ea5e9", textTransform: "uppercase" }}>
            {t("loyaltyPage.cta.kicker")}
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, marginTop: 6, lineHeight: 1.25 }}>{t("loyaltyPage.cta.title")}</div>
          <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            <Link href="/bank/wishlist" style={ctaPrimary}>{t("loyaltyPage.cta.wishlist")} →</Link>
            <Link href="/bank/savings" style={ctaSecondary}>{t("loyaltyPage.cta.savings")} →</Link>
          </div>
        </section>

        <div style={{ marginTop: 16 }}><InstallBanner /></div>
        <div style={{ marginTop: 16 }}><SubrouteFooter /></div>
      </div>

      {toastMsg && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            padding: "12px 20px",
            borderRadius: 12,
            background: toastColor,
            color: "#fff",
            fontSize: 13,
            fontWeight: 800,
            boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
            zIndex: 9999,
            maxWidth: 360,
          }}
        >
          {toastMsg}
        </div>
      )}
    </main>
  );
}

const ctaPrimary: React.CSSProperties = {
  padding: "12px 20px",
  borderRadius: 12,
  background: "linear-gradient(135deg, #0ea5e9, #6366f1)",
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

export default function LoyaltyPage() {
  return (
    <CurrencyProvider>
      <LoyaltyInner />
    </CurrencyProvider>
  );
}
