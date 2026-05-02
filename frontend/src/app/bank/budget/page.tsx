"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { InstallBanner } from "../_components/InstallBanner";
import { BudgetCaps as BudgetCapsCard } from "../_components/BudgetCaps";
import { SubrouteFooter } from "../_components/SubrouteFooter";
import { CurrencyProvider } from "../_lib/CurrencyContext";
import { listAccounts, listOperations } from "../_lib/api";
import {
  BUDGET_CAPS_EVENT,
  evaluateCaps,
  loadBudgetCaps,
  type CapProgress,
} from "../_lib/budgetCaps";
import { formatCurrency, loadCurrency, type CurrencyCode } from "../_lib/currency";
import { CATEGORY_COLOR, CATEGORY_LABEL_KEY, type SpendCategory } from "../_lib/spending";
import type { Account, Operation } from "../_lib/types";

type ProjectedRow = CapProgress & { projected: number; projectedRatio: number };

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

function BudgetInner() {
  const { t } = useI18n();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [code, setCode] = useState<CurrencyCode>("AEC");
  const [loaded, setLoaded] = useState(false);
  const [tick, setTick] = useState(0);

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
    let cancelled = false;
    (async () => {
      try {
        const [a, o] = await Promise.all([listAccounts(), listOperations()]);
        if (cancelled) return;
        setAccounts(a);
        setOperations(o);
      } catch {
        // offline — local caps still work
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    window.addEventListener(BUDGET_CAPS_EVENT, bump);
    window.addEventListener("storage", bump);
    return () => {
      window.removeEventListener(BUDGET_CAPS_EVENT, bump);
      window.removeEventListener("storage", bump);
    };
  }, []);

  const myAccount = accounts[0] ?? null;

  const { rows, monthDay, monthDays, daysRemaining, totalSpent, totalCap, anyCap } = useMemo(() => {
    void tick;
    const caps = loadBudgetCaps();
    const now = new Date();
    const day = now.getDate();
    const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const remaining = Math.max(0, days - day);
    const pace = day / days;
    const progress: CapProgress[] = myAccount
      ? evaluateCaps(operations, myAccount.id, caps, now)
      : (Object.keys(caps) as SpendCategory[]).map((c) => ({
          category: c,
          cap: caps[c],
          spent: 0,
          ratio: 0,
          status: caps[c] === null ? "uncapped" : "ok",
        }));
    const projected: ProjectedRow[] = progress.map((p) => {
      const proj = pace > 0 ? p.spent / pace : p.spent;
      const projRatio = p.cap !== null && p.cap > 0 ? proj / p.cap : 0;
      return { ...p, projected: proj, projectedRatio: projRatio };
    });
    const spentSum = progress.reduce((s, p) => s + p.spent, 0);
    const capSum = progress.reduce((s, p) => s + (p.cap ?? 0), 0);
    const hasAnyCap = progress.some((p) => p.cap !== null && p.cap > 0);
    return {
      rows: projected,
      monthDay: day,
      monthDays: days,
      daysRemaining: remaining,
      totalSpent: spentSum,
      totalCap: capSum,
      anyCap: hasAnyCap,
    };
  }, [operations, myAccount, tick]);

  const projectedTotal = useMemo(() => rows.reduce((s, r) => s + r.projected, 0), [rows]);
  const overallStatus: "ontrack" | "risk" | "over" | "none" = useMemo(() => {
    if (!anyCap) return "none";
    if (projectedTotal > totalCap * 1.05) return "over";
    if (projectedTotal > totalCap * 0.95) return "risk";
    return "ontrack";
  }, [anyCap, projectedTotal, totalCap]);

  const fmt = (n: number) => formatCurrency(n, code);

  const atRisk = useMemo(
    () =>
      rows
        .filter((r) => r.cap !== null && r.cap > 0 && r.projectedRatio > 1)
        .sort((a, b) => b.projectedRatio - a.projectedRatio),
    [rows],
  );

  const overallAccent =
    overallStatus === "over"
      ? "#f87171"
      : overallStatus === "risk"
        ? "#fbbf24"
        : overallStatus === "ontrack"
          ? "#5eead4"
          : "#94a3b8";

  const toastColor =
    toastType === "success" ? "#0d9488" : toastType === "error" ? "#dc2626" : "#6366f1";

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 70% 10%, rgba(217,119,6,0.20), transparent 55%), linear-gradient(180deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)",
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
              color: "#fbbf24",
              textTransform: "uppercase",
            }}
          >
            {t("budgetPage.kicker")}
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
            {t("budgetPage.headline")}
          </h1>
          <div style={{ fontSize: 15, color: "#cbd5e1", lineHeight: 1.55, maxWidth: 640 }}>
            {t("budgetPage.lede")}
          </div>
        </header>

        {/* Summary stats bar */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
          <StatCard
            label={t("budgetPage.stat.spent")}
            value={fmt(totalSpent)}
            hint={t("budgetPage.stat.spent.hint", { day: monthDay, days: monthDays })}
            accent="#5eead4"
          />
          <StatCard
            label={t("budgetPage.stat.cap")}
            value={anyCap ? fmt(totalCap) : "—"}
            hint={anyCap ? t("budgetPage.stat.cap.hint") : t("budgetPage.stat.cap.empty")}
            accent="#0ea5e9"
          />
          <StatCard
            label={t("budgetPage.stat.projected")}
            value={anyCap ? fmt(projectedTotal) : "—"}
            hint={
              anyCap
                ? t("budgetPage.stat.projected.hint", {
                    diff: projectedTotal >= totalCap ? "+" : "−",
                    amt: fmt(Math.abs(projectedTotal - totalCap)),
                  })
                : t("budgetPage.stat.projected.empty")
            }
            accent={overallAccent}
          />
          <StatCard
            label={t("budgetPage.stat.daysLeft")}
            value={String(daysRemaining)}
            hint={t("budgetPage.stat.daysLeft.hint", { day: monthDay, days: monthDays })}
            accent="#a78bfa"
          />
        </div>

        {/* Overall status pill */}
        {anyCap && (
          <div
            role="status"
            aria-live="polite"
            style={{
              padding: "12px 18px",
              borderRadius: 14,
              border: `1px solid ${overallAccent}55`,
              background: `${overallAccent}14`,
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
                color: overallAccent,
                padding: "4px 10px",
                borderRadius: 999,
                background: `${overallAccent}22`,
                whiteSpace: "nowrap",
              }}
            >
              {t(`budgetPage.status.${overallStatus}`)}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              {t(`budgetPage.statusBody.${overallStatus}`, {
                spent: fmt(totalSpent),
                cap: fmt(totalCap),
                projected: fmt(projectedTotal),
                days: daysRemaining,
              })}
            </span>
          </div>
        )}

        {/* At-risk surface */}
        {anyCap && atRisk.length > 0 && (
          <section style={{ marginBottom: 18 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: 4,
                textTransform: "uppercase",
                color: "#f87171",
                marginBottom: 8,
              }}
            >
              {t("budgetPage.atRisk.kicker")}
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 900, margin: "0 0 12px 0", lineHeight: 1.2, letterSpacing: -0.4 }}>
              {t("budgetPage.atRisk.title")}
            </h2>
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {atRisk.map((r) => {
                const overPct = Math.round((r.projectedRatio - 1) * 100);
                return (
                  <li
                    key={r.category}
                    style={{
                      padding: 14,
                      borderRadius: 12,
                      background: "rgba(15,23,42,0.55)",
                      border: "1px solid rgba(248,113,113,0.20)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span
                        aria-hidden
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 999,
                          background: CATEGORY_COLOR[r.category],
                          display: "inline-block",
                        }}
                      />
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>
                          {t(CATEGORY_LABEL_KEY[r.category])}
                        </div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>
                          {t("budgetPage.atRisk.row", {
                            spent: fmt(r.spent),
                            cap: fmt(r.cap ?? 0),
                            projected: fmt(r.projected),
                          })}
                        </div>
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 900,
                        color: "#f87171",
                        whiteSpace: "nowrap",
                      }}
                    >
                      +{overPct}%
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Empty state for no caps */}
        {loaded && !anyCap && (
          <div
            style={{
              padding: 28,
              borderRadius: 16,
              background: "rgba(15,23,42,0.55)",
              border: "1px dashed rgba(251,191,36,0.30)",
              textAlign: "center",
              color: "#cbd5e1",
              marginBottom: 24,
            }}
          >
            <div aria-hidden style={{ fontSize: 42, color: "#fbbf24", marginBottom: 10, lineHeight: 1 }}>
              ◇
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 6 }}>
              {t("budgetPage.empty.title")}
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6, maxWidth: 460, margin: "0 auto" }}>
              {t("budgetPage.empty.body")}
            </div>
          </div>
        )}

        {/* The cap-editor card */}
        <div style={{ background: "#fff", color: "#0f172a", borderRadius: 16, padding: 4, marginBottom: 18 }}>
          <BudgetCapsCard
            myAccountId={myAccount?.id ?? ""}
            operations={operations}
            notify={notify}
          />
        </div>

        {/* CTA */}
        <section
          style={{
            padding: 22,
            borderRadius: 16,
            background: "linear-gradient(135deg, rgba(217,119,6,0.18), rgba(99,102,241,0.10))",
            border: "1px solid rgba(251,191,36,0.30)",
            marginTop: 8,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 4,
              color: "#fbbf24",
              textTransform: "uppercase",
            }}
          >
            {t("budgetPage.cta.kicker")}
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, marginTop: 6, lineHeight: 1.25 }}>
            {t("budgetPage.cta.title")}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            <Link
              href="/bank/insights"
              style={{
                padding: "12px 20px",
                borderRadius: 12,
                background: "linear-gradient(135deg, #d97706, #db2777)",
                color: "#fff",
                fontSize: 13,
                fontWeight: 800,
                textDecoration: "none",
              }}
            >
              {t("budgetPage.cta.insights")} →
            </Link>
            <Link
              href="/bank/recurring"
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
              {t("budgetPage.cta.recurring")} →
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

export default function BudgetPage() {
  return (
    <CurrencyProvider>
      <BudgetInner />
    </CurrencyProvider>
  );
}
