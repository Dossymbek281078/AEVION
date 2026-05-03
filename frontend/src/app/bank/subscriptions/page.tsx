"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { InstallBanner } from "../_components/InstallBanner";
import { SubrouteFooter } from "../_components/SubrouteFooter";
import { SubscriptionScanner } from "../_components/SubscriptionScanner";
import { CurrencyProvider } from "../_lib/CurrencyContext";
import { formatCurrency, loadCurrency, type CurrencyCode } from "../_lib/currency";
import {
  loadRecurring,
  RECURRING_EVENT,
  type Recurring,
} from "../_lib/recurring";
import { scanRecurring, totalMonthlySpend } from "../_lib/subscriptionScan";

function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent: string;
}) {
  return (
    <div
      style={{
        flex: "1 1 180px",
        padding: "16px 20px",
        borderRadius: 14,
        background: "rgba(15,23,42,0.55)",
        border: `1px solid ${accent}33`,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: 3,
          textTransform: "uppercase",
          color: accent,
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 900, color: "#f8fafc", letterSpacing: -0.5, lineHeight: 1.1 }}>
        {value}
      </div>
      {hint ? (
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 4 }}>{hint}</div>
      ) : null}
    </div>
  );
}

function SubscriptionsInner() {
  const { t } = useI18n();
  const [items, setItems] = useState<Recurring[]>([]);
  const [code, setCode] = useState<CurrencyCode>("AEC");

  const [toastMsg, setToastMsg] = useState<string>("");
  const [toastType, setToastType] = useState<"success" | "error" | "info">("info");

  const notify = useCallback((msg: string, type: "success" | "error" | "info" = "info") => {
    setToastMsg(msg);
    setToastType(type);
    const tid = setTimeout(() => setToastMsg(""), 3500);
    return () => clearTimeout(tid);
  }, []);

  useEffect(() => {
    setCode(loadCurrency());
    setItems(loadRecurring());
    const reload = () => setItems(loadRecurring());
    window.addEventListener(RECURRING_EVENT, reload);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener(RECURRING_EVENT, reload);
      window.removeEventListener("storage", reload);
    };
  }, []);

  const fmt = (n: number) => formatCurrency(n, code);

  const findings = useMemo(() => scanRecurring(items), [items]);
  const monthly = useMemo(() => totalMonthlySpend(items), [items]);

  const flaggedMonthly = useMemo(() => {
    let sum = 0;
    for (const f of findings) {
      if (!f.recurring.active) continue;
      const r = f.recurring;
      switch (r.period) {
        case "daily":
          sum += r.amount * 30;
          break;
        case "weekly":
          sum += r.amount * 4.33;
          break;
        case "biweekly":
          sum += r.amount * 2.17;
          break;
        case "monthly":
          sum += r.amount;
          break;
      }
    }
    return sum;
  }, [findings]);

  const flagCounts = useMemo(() => {
    let stale = 0;
    let expensive = 0;
    let duplicate = 0;
    for (const f of findings) {
      if (f.flags.includes("stale")) stale++;
      if (f.flags.includes("expensive")) expensive++;
      if (f.flags.includes("duplicate")) duplicate++;
    }
    return { stale, expensive, duplicate };
  }, [findings]);

  const activeCount = useMemo(() => items.filter((r) => r.active).length, [items]);
  const flaggedShare = monthly > 0 ? Math.round((flaggedMonthly / monthly) * 100) : 0;

  const toastColor =
    toastType === "success" ? "#0d9488" : toastType === "error" ? "#dc2626" : "#6366f1";

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 70% 0%, rgba(220,38,38,0.18), transparent 55%), linear-gradient(180deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)",
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
              color: "#f87171",
              textTransform: "uppercase",
            }}
          >
            {t("subsPage.kicker")}
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
            {t("subsPage.headline")}
          </h1>
          <div style={{ fontSize: 15, color: "#cbd5e1", lineHeight: 1.55, maxWidth: 640 }}>
            {t("subsPage.lede")}
          </div>
        </header>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
          <StatCard
            label={t("subsPage.stat.monthly")}
            value={fmt(monthly)}
            hint={
              activeCount > 0
                ? t("subsPage.stat.monthly.hint", { count: activeCount })
                : t("subsPage.stat.monthly.empty")
            }
            accent="#5eead4"
          />
          <StatCard
            label={t("subsPage.stat.flagged")}
            value={String(findings.length)}
            hint={
              findings.length > 0
                ? t("subsPage.stat.flagged.hint", { share: flaggedShare })
                : t("subsPage.stat.flagged.empty")
            }
            accent={findings.length > 0 ? "#f87171" : "#0ea5e9"}
          />
          <StatCard
            label={t("subsPage.stat.expensive")}
            value={String(flagCounts.expensive)}
            hint={t("subsPage.stat.expensive.hint")}
            accent="#dc2626"
          />
          <StatCard
            label={t("subsPage.stat.duplicate")}
            value={String(flagCounts.duplicate)}
            hint={t("subsPage.stat.duplicate.hint")}
            accent="#d97706"
          />
        </div>

        {/* Status card */}
        {activeCount > 0 && (
          <div
            role="status"
            aria-live="polite"
            style={{
              padding: "12px 18px",
              borderRadius: 14,
              border: `1px solid ${findings.length > 0 ? "#f8717155" : "#5eead455"}`,
              background: findings.length > 0 ? "rgba(248,113,113,0.10)" : "rgba(94,234,212,0.10)",
              color: "#f8fafc",
              fontSize: 13,
              lineHeight: 1.5,
              marginBottom: 18,
              display: "flex",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <span
              aria-hidden
              style={{
                fontSize: 11,
                fontWeight: 900,
                letterSpacing: 3,
                textTransform: "uppercase",
                color: findings.length > 0 ? "#f87171" : "#5eead4",
                padding: "4px 10px",
                borderRadius: 999,
                background: findings.length > 0 ? "rgba(248,113,113,0.18)" : "rgba(94,234,212,0.18)",
                whiteSpace: "nowrap",
              }}
            >
              {findings.length > 0 ? t("subsPage.status.flagged") : t("subsPage.status.clean")}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              {findings.length > 0
                ? t("subsPage.statusBody.flagged", {
                    count: findings.length,
                    saved: fmt(flaggedMonthly),
                  })
                : t("subsPage.statusBody.clean", { monthly: fmt(monthly) })}
            </span>
          </div>
        )}

        {/* Empty state when no recurring rules */}
        {activeCount === 0 && (
          <div
            style={{
              padding: 28,
              borderRadius: 16,
              background: "rgba(15,23,42,0.55)",
              border: "1px dashed rgba(248,113,113,0.30)",
              textAlign: "center",
              color: "#cbd5e1",
              marginBottom: 24,
            }}
          >
            <div aria-hidden style={{ fontSize: 42, color: "#f87171", marginBottom: 10, lineHeight: 1 }}>
              ◇
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 6 }}>
              {t("subsPage.empty.title")}
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6, maxWidth: 460, margin: "0 auto" }}>
              {t("subsPage.empty.body")}
            </div>
            <div style={{ marginTop: 16 }}>
              <Link
                href="/bank/recurring"
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
                {t("subsPage.empty.cta")} →
              </Link>
            </div>
          </div>
        )}

        {/* Scanner card on white surface */}
        {activeCount > 0 && (
          <div style={{ background: "#fff", color: "#0f172a", borderRadius: 16, padding: 4, marginBottom: 18 }}>
            <SubscriptionScanner notify={notify} />
          </div>
        )}

        {/* CTA */}
        <section
          style={{
            padding: 22,
            borderRadius: 16,
            background: "linear-gradient(135deg, rgba(220,38,38,0.16), rgba(99,102,241,0.10))",
            border: "1px solid rgba(248,113,113,0.30)",
            marginTop: 8,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 4,
              color: "#f87171",
              textTransform: "uppercase",
            }}
          >
            {t("subsPage.cta.kicker")}
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, marginTop: 6, lineHeight: 1.25 }}>
            {t("subsPage.cta.title")}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            <Link
              href="/bank/recurring"
              style={{
                padding: "12px 20px",
                borderRadius: 12,
                background: "linear-gradient(135deg, #f87171, #db2777)",
                color: "#fff",
                fontSize: 13,
                fontWeight: 800,
                textDecoration: "none",
              }}
            >
              {t("subsPage.cta.recurring")} →
            </Link>
            <Link
              href="/bank/calendar"
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
              {t("subsPage.cta.calendar")} →
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

export default function SubscriptionsPage() {
  return (
    <CurrencyProvider>
      <SubscriptionsInner />
    </CurrencyProvider>
  );
}
