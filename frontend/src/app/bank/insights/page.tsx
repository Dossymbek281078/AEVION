"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { InstallBanner } from "../_components/InstallBanner";
import { SubrouteFooter } from "../_components/SubrouteFooter";
import { listAccounts, listOperations } from "../_lib/api";
import { contactsById } from "../_lib/contacts";
import { formatCurrency, loadCurrency, type CurrencyCode } from "../_lib/currency";
import {
  CATEGORY_COLOR,
  CATEGORY_DESCRIPTION_KEY,
  CATEGORY_LABEL_KEY,
  PERIOD_LABEL_KEY,
  summariseSpending,
  type SpendCategory,
  type SpendingPeriod,
} from "../_lib/spending";
import type { Account, Operation } from "../_lib/types";

const PERIODS: SpendingPeriod[] = ["thisMonth", "last30d"];

export default function InsightsPage() {
  const { t, lang } = useI18n();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [code, setCode] = useState<CurrencyCode>("AEC");
  const [period, setPeriod] = useState<SpendingPeriod>("thisMonth");
  const [loaded, setLoaded] = useState(false);

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
        // offline ok
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const myAccount = accounts[0] ?? null;

  const summary = useMemo(() => {
    if (!myAccount) return null;
    return summariseSpending(operations, myAccount.id, period);
  }, [operations, myAccount, period]);

  // Top counterparties — grouped by recipient id, period-windowed.
  const topRecipients = useMemo(() => {
    if (!myAccount) return [];
    const cutoff = period === "last30d"
      ? Date.now() - 30 * 86_400_000
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
    const byId = new Map<string, { count: number; amount: number }>();
    for (const op of operations) {
      if (op.kind !== "transfer" || op.from !== myAccount.id) continue;
      const ts = new Date(op.createdAt).getTime();
      if (!Number.isFinite(ts) || ts < cutoff) continue;
      const recipientId = op.to;
      const entry = byId.get(recipientId) ?? { count: 0, amount: 0 };
      entry.count += 1;
      entry.amount += op.amount;
      byId.set(recipientId, entry);
    }
    const labels = contactsById();
    return Array.from(byId.entries())
      .map(([id, stats]) => ({
        id,
        nickname: labels.get(id) ?? null,
        ...stats,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [operations, myAccount, period]);

  const fmt = (n: number) => formatCurrency(n, code);
  const dateFmt = (iso: string) => {
    try {
      return new Intl.DateTimeFormat(
        lang === "kk" ? "kk-KZ" : lang === "ru" ? "ru-RU" : "en-US",
        { dateStyle: "medium" },
      ).format(new Date(iso));
    } catch {
      return iso;
    }
  };

  const totalsForBar = useMemo(() => {
    if (!summary || summary.totalSpent === 0) return [];
    return summary.byCategory
      .filter((c) => c.amount > 0)
      .map((c) => ({
        ...c,
        pct: (c.amount / summary.totalSpent) * 100,
      }));
  }, [summary]);

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 50% 0%, rgba(13,148,136,0.16), transparent 60%), linear-gradient(180deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)",
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
            {t("insightsPage.kicker")}
          </div>
          <h1 style={{ fontSize: 40, fontWeight: 900, letterSpacing: -1.2, lineHeight: 1.05, marginTop: 14, marginBottom: 8 }}>
            {t("insightsPage.headline")}
          </h1>
          <div style={{ fontSize: 15, color: "#cbd5e1", lineHeight: 1.55, maxWidth: 640 }}>
            {t("insightsPage.lede")}
          </div>
        </header>

        {/* Period switch */}
        <div
          role="tablist"
          aria-label={t("insightsPage.periodAria")}
          style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}
        >
          {PERIODS.map((p) => {
            const active = period === p;
            return (
              <button
                key={p}
                role="tab"
                aria-selected={active}
                type="button"
                onClick={() => setPeriod(p)}
                style={{
                  padding: "8px 14px",
                  borderRadius: 999,
                  background: active
                    ? "linear-gradient(135deg, #0d9488, #0ea5e9)"
                    : "rgba(15,23,42,0.55)",
                  color: active ? "#fff" : "#cbd5e1",
                  border: active
                    ? "1px solid rgba(94,234,212,0.40)"
                    : "1px solid rgba(255,255,255,0.10)",
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  cursor: "pointer",
                }}
              >
                {t(PERIOD_LABEL_KEY[p])}
              </button>
            );
          })}
        </div>

        {/* No-data state */}
        {loaded && (!summary || summary.count === 0) && (
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
              {t("insightsPage.empty.title")}
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6, maxWidth: 460, margin: "0 auto" }}>
              {t("insightsPage.empty.body")}
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
                {t("about.cta.openBank")}
              </Link>
            </div>
          </div>
        )}

        {summary && summary.count > 0 && (
          <>
            {/* Hero stats */}
            <section
              style={{
                padding: 22,
                borderRadius: 18,
                background: "linear-gradient(135deg, rgba(13,148,136,0.18), rgba(99,102,241,0.10))",
                border: "1px solid rgba(94,234,212,0.30)",
                marginBottom: 18,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 4, color: "#5eead4", textTransform: "uppercase" }}>
                {t("insightsPage.total.kicker", { period: t(PERIOD_LABEL_KEY[period]).toLowerCase() })}
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: 12,
                  marginTop: 6,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ fontSize: 44, fontWeight: 900, letterSpacing: -1.5, lineHeight: 1.05 }}>
                  −{fmt(summary.totalSpent)}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: summary.pctVsPrev > 0 ? "#fbbf24" : "#5eead4",
                    padding: "6px 12px",
                    borderRadius: 999,
                    background:
                      summary.pctVsPrev > 0
                        ? "rgba(251,191,36,0.10)"
                        : "rgba(94,234,212,0.10)",
                    border:
                      summary.pctVsPrev > 0
                        ? "1px solid rgba(251,191,36,0.30)"
                        : "1px solid rgba(94,234,212,0.30)",
                  }}
                >
                  {summary.pctVsPrev >= 0 ? "+" : ""}
                  {summary.pctVsPrev.toFixed(0)}% {t("insightsPage.vsPrev")}
                </div>
              </div>
              <div style={{ fontSize: 13, color: "#cbd5e1", marginTop: 8 }}>
                {t("insightsPage.total.body", {
                  count: summary.count,
                  prev: fmt(summary.totalSpentPrev),
                })}
              </div>
            </section>

            {/* Stacked bar */}
            <section style={{ marginBottom: 18 }}>
              <SectionHeader
                kicker={t("insightsPage.bar.kicker")}
                title={t("insightsPage.bar.title")}
                accent="#5eead4"
              />
              <div
                style={{
                  display: "flex",
                  height: 28,
                  borderRadius: 8,
                  overflow: "hidden",
                  background: "rgba(255,255,255,0.06)",
                  marginBottom: 10,
                }}
                role="img"
                aria-label={t("insightsPage.bar.aria")}
              >
                {totalsForBar.map((b) => (
                  <div
                    key={b.category}
                    style={{
                      width: `${b.pct}%`,
                      background: CATEGORY_COLOR[b.category],
                      transition: "width 600ms ease-out",
                    }}
                    title={`${t(CATEGORY_LABEL_KEY[b.category])} · ${b.pct.toFixed(0)}%`}
                  />
                ))}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {totalsForBar.map((b) => (
                  <div
                    key={b.category}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 11,
                      color: "rgba(255,255,255,0.75)",
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 999,
                        background: CATEGORY_COLOR[b.category],
                        display: "inline-block",
                      }}
                    />
                    {t(CATEGORY_LABEL_KEY[b.category])} · {b.pct.toFixed(0)}%
                  </div>
                ))}
              </div>
            </section>

            {/* Category breakdown */}
            <SectionHeader
              kicker={t("insightsPage.breakdown.kicker")}
              title={t("insightsPage.breakdown.title")}
              accent="#a78bfa"
            />
            <ul style={listStyle}>
              {summary.byCategory
                .filter((c) => c.amount > 0)
                .map((c) => {
                  const prev = summary.byCategoryPrev[c.category];
                  const delta = prev > 0 ? ((c.amount - prev) / prev) * 100 : 0;
                  return (
                    <li
                      key={c.category}
                      style={{
                        padding: 14,
                        borderRadius: 12,
                        background: "rgba(15,23,42,0.55)",
                        border: `1px solid ${CATEGORY_COLOR[c.category]}1f`,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>
                            {t(CATEGORY_LABEL_KEY[c.category])}
                          </div>
                          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>
                            {t(CATEGORY_DESCRIPTION_KEY[c.category])} ·{" "}
                            {c.count === 1
                              ? t("insightsPage.opOne", { count: c.count })
                              : t("insightsPage.opMany", { count: c.count })}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 18, fontWeight: 900, color: CATEGORY_COLOR[c.category] }}>
                            {fmt(c.amount)}
                          </div>
                          {prev > 0 && (
                            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>
                              {delta >= 0 ? "+" : ""}
                              {delta.toFixed(0)}% {t("insightsPage.vsPrev")}
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
            </ul>

            {/* Biggest transaction */}
            {summary.biggestTx && (
              <>
                <SectionHeader
                  kicker={t("insightsPage.biggest.kicker")}
                  title={t("insightsPage.biggest.title")}
                  accent="#fbbf24"
                />
                <div
                  style={{
                    padding: 16,
                    borderRadius: 12,
                    background: "rgba(15,23,42,0.55)",
                    border: "1px solid rgba(251,191,36,0.20)",
                    marginBottom: 28,
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", letterSpacing: 1, fontFamily: "ui-monospace, SFMono-Regular, monospace" }}>
                      {summary.biggestTx.op.id}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginTop: 4 }}>
                      {dateFmt(summary.biggestTx.op.createdAt)} · {t(CATEGORY_LABEL_KEY[summary.biggestTx.category])}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ fontSize: 24, fontWeight: 900, color: "#fbbf24" }}>
                      −{fmt(summary.biggestTx.op.amount)}
                    </div>
                    <Link
                      href={`/bank/receipt/${summary.biggestTx.op.id}`}
                      style={{
                        padding: "8px 14px",
                        borderRadius: 999,
                        border: "1px solid rgba(251,191,36,0.40)",
                        color: "#fbbf24",
                        background: "rgba(251,191,36,0.08)",
                        fontSize: 11,
                        fontWeight: 800,
                        letterSpacing: 1.5,
                        textTransform: "uppercase",
                        textDecoration: "none",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {t("insightsPage.biggest.receipt")} →
                    </Link>
                  </div>
                </div>
              </>
            )}

            {/* Top recipients */}
            {topRecipients.length > 0 && (
              <>
                <SectionHeader
                  kicker={t("insightsPage.recipients.kicker")}
                  title={t("insightsPage.recipients.title")}
                  accent="#0ea5e9"
                />
                <ul style={listStyle}>
                  {topRecipients.map((r) => (
                    <li
                      key={r.id}
                      style={{
                        padding: 14,
                        borderRadius: 12,
                        background: "rgba(15,23,42,0.55)",
                        border: "1px solid rgba(14,165,233,0.18)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>
                            {r.nickname ?? t("insightsPage.recipients.unknown")}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: "rgba(255,255,255,0.55)",
                              marginTop: 2,
                              fontFamily: "ui-monospace, SFMono-Regular, monospace",
                              wordBreak: "break-all",
                            }}
                          >
                            {r.id}
                          </div>
                          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>
                            {r.count === 1
                              ? t("insightsPage.opOne", { count: r.count })
                              : t("insightsPage.opMany", { count: r.count })}
                          </div>
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: "#0ea5e9" }}>
                          −{fmt(r.amount)}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
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
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 4, color: "#5eead4", textTransform: "uppercase" }}>
            {t("insightsPage.cta.kicker")}
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, marginTop: 6, lineHeight: 1.25 }}>
            {t("insightsPage.cta.title")}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            <Link href="/bank/statement" style={ctaPrimary}>
              {t("insightsPage.cta.statement")} →
            </Link>
            <Link href="/bank/savings" style={ctaSecondary}>
              {t("insightsPage.cta.savings")} →
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

function SectionHeader({ kicker, title, accent }: { kicker: string; title: string; accent: string }) {
  return (
    <div style={{ marginTop: 8, marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 4, textTransform: "uppercase", color: accent }}>
        {kicker}
      </div>
      <h2 style={{ fontSize: 22, fontWeight: 900, margin: "4px 0 0 0", lineHeight: 1.2, letterSpacing: -0.4 }}>
        {title}
      </h2>
    </div>
  );
}

const listStyle: React.CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: "0 0 24px 0",
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

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
