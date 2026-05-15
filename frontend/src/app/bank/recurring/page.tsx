"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { InstallBanner } from "../_components/InstallBanner";
import { RecurringPayments } from "../_components/RecurringPayments";
import { SubrouteFooter } from "../_components/SubrouteFooter";
import { useAuthMe } from "../_hooks/useAuthMe";
import { useBank } from "../_hooks/useBank";
import { formatCurrency, loadCurrency, type CurrencyCode } from "../_lib/currency";
import {
  formatCountdown,
  loadRecurring,
  RECURRING_EVENT,
  type Recurring,
} from "../_lib/recurring";

// ── helpers ────────────────────────────────────────────────────────────────

function monthlyEquivalent(r: Recurring): number {
  switch (r.period) {
    case "daily":
      return r.amount * 30;
    case "weekly":
      return r.amount * 4.33;
    case "biweekly":
      return r.amount * 2.17;
    case "monthly":
    default:
      return r.amount;
  }
}

function nextDue(items: Recurring[]): Recurring | null {
  const active = items.filter((r) => r.active);
  if (!active.length) return null;
  return active.reduce((a, b) =>
    new Date(a.nextRunAt).getTime() < new Date(b.nextRunAt).getTime() ? a : b,
  );
}

// ── stat card ──────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div
      style={{
        flex: "1 1 160px",
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
      <div style={{ fontSize: 24, fontWeight: 900, color: "#f8fafc", letterSpacing: -0.5 }}>
        {value}
      </div>
    </div>
  );
}

// ── page ───────────────────────────────────────────────────────────────────

export default function RecurringPage() {
  const { t } = useI18n();
  const { me, checked } = useAuthMe();

  const [toastMsg, setToastMsg] = useState<string>("");
  const [toastType, setToastType] = useState<"success" | "error" | "info">("info");

  const notify = useCallback((msg: string, type: "success" | "error" | "info" = "info") => {
    setToastMsg(msg);
    setToastType(type);
    const tid = setTimeout(() => setToastMsg(""), 3500);
    return () => clearTimeout(tid);
  }, []);

  const { account, send } = useBank(me, (msg) => notify(msg, "error"));

  const [code, setCode] = useState<CurrencyCode>("AEC");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setCode(loadCurrency());
  }, []);

  useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    window.addEventListener(RECURRING_EVENT, bump);
    window.addEventListener("storage", bump);
    return () => {
      window.removeEventListener(RECURRING_EVENT, bump);
      window.removeEventListener("storage", bump);
    };
  }, []);

  const items = useMemo(() => {
    void tick; // reactive re-read on change
    return loadRecurring();
  }, [tick]);

  const fmt = (n: number) => formatCurrency(n, code);

  const monthlyTotal = useMemo(
    () => items.filter((r) => r.active).reduce((s, r) => s + monthlyEquivalent(r), 0),
    [items],
  );

  const activeCount = useMemo(() => items.filter((r) => r.active).length, [items]);
  const pausedCount = useMemo(() => items.filter((r) => !r.active).length, [items]);
  const nextItem = useMemo(() => nextDue(items), [items]);

  const toastColor =
    toastType === "success" ? "#0d9488" : toastType === "error" ? "#dc2626" : "#6366f1";

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 30% 20%, rgba(13,148,136,0.16), transparent 55%), linear-gradient(180deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)",
        color: "#f8fafc",
        padding: "32px 16px 56px",
      }}
    >
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        {/* Back link */}
        <Link
          href="/bank"
          style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", textDecoration: "none", fontWeight: 700 }}
        >
          {`← ${t("about.backToBank")}`}
        </Link>

        {/* Header */}
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
            {t("recurringPage.kicker")}
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
            {t("recurringPage.headline")}
          </h1>
          <div style={{ fontSize: 15, color: "#cbd5e1", lineHeight: 1.55, maxWidth: 640 }}>
            {t("recurringPage.lede")}
          </div>
        </header>

        {/* Summary stats bar */}
        {items.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              marginBottom: 20,
            }}
          >
            <StatCard
              label={t("recurringPage.stat.monthly")}
              value={`~${fmt(monthlyTotal)}`}
              accent="#5eead4"
            />
            <StatCard
              label={t("recurringPage.stat.active")}
              value={String(activeCount)}
              accent="#0ea5e9"
            />
            <StatCard
              label={t("recurringPage.stat.paused")}
              value={String(pausedCount)}
              accent="#94a3b8"
            />
            <StatCard
              label={t("recurringPage.stat.nextDue")}
              value={nextItem ? formatCountdown(nextItem.nextRunAt, t) : "—"}
              accent="#a78bfa"
            />
          </div>
        )}

        {/* Auth gate — show loading until checked */}
        {!checked && (
          <div
            style={{
              padding: 20,
              borderRadius: 14,
              background: "rgba(15,23,42,0.55)",
              border: "1px dashed rgba(94,234,212,0.25)",
              color: "#cbd5e1",
              fontSize: 14,
              marginBottom: 20,
            }}
          >
            {t("recurringPage.loading")}
          </div>
        )}

        {/* Main recurring component */}
        {checked && (
          <RecurringPayments
            myAccountId={account?.id ?? ""}
            balance={account?.balance ?? 0}
            send={send}
            notify={notify}
          />
        )}

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
            {t("recurringPage.cta.kicker")}
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, marginTop: 6, lineHeight: 1.25 }}>
            {t("recurringPage.cta.title")}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            <Link
              href="/bank/insights"
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
              {t("recurringPage.cta.insights")} →
            </Link>
            <Link
              href="/bank/savings"
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
              {t("recurringPage.cta.savings")} →
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

      {/* Toast */}
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
