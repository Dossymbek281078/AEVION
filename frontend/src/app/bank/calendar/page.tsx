"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { BillingCalendar } from "../_components/BillingCalendar";
import { InstallBanner } from "../_components/InstallBanner";
import { SubrouteFooter } from "../_components/SubrouteFooter";
import { CurrencyProvider } from "../_lib/CurrencyContext";
import { formatCurrency, loadCurrency, type CurrencyCode } from "../_lib/currency";
import {
  addPeriod,
  loadRecurring,
  RECURRING_EVENT,
  type Recurring,
} from "../_lib/recurring";

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

function projectTotal(items: Recurring[], horizonDays: number): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setDate(today.getDate() + horizonDays);
  let total = 0;
  for (const r of items) {
    if (!r.active) continue;
    let cursor = new Date(r.nextRunAt);
    let safety = 0;
    while (cursor < end && safety < 60) {
      if (cursor >= today) total += r.amount;
      cursor = addPeriod(cursor, r.period);
      safety++;
    }
  }
  return total;
}

function CalendarInner() {
  const { t, lang } = useI18n();
  const [items, setItems] = useState<Recurring[]>([]);
  const [code, setCode] = useState<CurrencyCode>("AEC");

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

  const total7 = useMemo(() => projectTotal(items, 7), [items]);
  const total14 = useMemo(() => projectTotal(items, 14), [items]);
  const total30 = useMemo(() => projectTotal(items, 30), [items]);
  const activeCount = useMemo(() => items.filter((r) => r.active).length, [items]);

  const nextItem = useMemo<Recurring | null>(() => {
    const active = items.filter((r) => r.active);
    if (!active.length) return null;
    return active.reduce((a, b) =>
      new Date(a.nextRunAt).getTime() < new Date(b.nextRunAt).getTime() ? a : b,
    );
  }, [items]);

  const nextDateLabel = useMemo(() => {
    if (!nextItem) return "—";
    try {
      return new Intl.DateTimeFormat(
        (lang as string) === "kk" ? "kk-KZ" : lang === "ru" ? "ru-RU" : "en-US",
        { dateStyle: "medium" },
      ).format(new Date(nextItem.nextRunAt));
    } catch {
      return nextItem.nextRunAt;
    }
  }, [nextItem, lang]);

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 30% 0%, rgba(13,148,136,0.18), transparent 60%), linear-gradient(180deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)",
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
            {t("calendarPage.kicker")}
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
            {t("calendarPage.headline")}
          </h1>
          <div style={{ fontSize: 15, color: "#cbd5e1", lineHeight: 1.55, maxWidth: 640 }}>
            {t("calendarPage.lede")}
          </div>
        </header>

        {/* Summary stats */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
          <StatCard
            label={t("calendarPage.stat.next7")}
            value={fmt(total7)}
            hint={t("calendarPage.stat.next7.hint")}
            accent="#5eead4"
          />
          <StatCard
            label={t("calendarPage.stat.next14")}
            value={fmt(total14)}
            hint={t("calendarPage.stat.next14.hint")}
            accent="#0ea5e9"
          />
          <StatCard
            label={t("calendarPage.stat.next30")}
            value={fmt(total30)}
            hint={t("calendarPage.stat.next30.hint")}
            accent="#a78bfa"
          />
          <StatCard
            label={t("calendarPage.stat.active")}
            value={String(activeCount)}
            hint={
              nextItem
                ? t("calendarPage.stat.nextLine", { label: nextItem.label, date: nextDateLabel })
                : t("calendarPage.stat.noActive")
            }
            accent="#fbbf24"
          />
        </div>

        {/* Empty state */}
        {activeCount === 0 && (
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
              {t("calendarPage.empty.title")}
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6, maxWidth: 460, margin: "0 auto" }}>
              {t("calendarPage.empty.body")}
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
                {t("calendarPage.empty.cta")} →
              </Link>
            </div>
          </div>
        )}

        {/* Calendar (white card on dark page) */}
        {activeCount > 0 && (
          <div style={{ background: "#fff", color: "#0f172a", borderRadius: 16, padding: 4, marginBottom: 18 }}>
            <BillingCalendar />
          </div>
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
            {t("calendarPage.cta.kicker")}
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, marginTop: 6, lineHeight: 1.25 }}>
            {t("calendarPage.cta.title")}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            <Link
              href="/bank/recurring"
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
              {t("calendarPage.cta.recurring")} →
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
              {t("calendarPage.cta.budget")} →
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

export default function CalendarPage() {
  return (
    <CurrencyProvider>
      <CalendarInner />
    </CurrencyProvider>
  );
}
