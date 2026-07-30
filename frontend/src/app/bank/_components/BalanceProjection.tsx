"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "../_lib/CurrencyContext";
import { convertFromAec, formatCurrency } from "../_lib/currency";
import { GIFTS_EVENT, pendingGifts, type Gift } from "../_lib/gifts";
import { loadRecurring, type Recurring } from "../_lib/recurring";
import type { Account } from "../_lib/types";

type Horizon = { key: "24h" | "7d" | "30d"; ms: number };

const HORIZONS: Horizon[] = [
  { key: "24h", ms: 24 * 60 * 60 * 1000 },
  { key: "7d", ms: 7 * 24 * 60 * 60 * 1000 },
  { key: "30d", ms: 30 * 24 * 60 * 60 * 1000 },
];

const PERIOD_DAYS = { daily: 1, weekly: 7, biweekly: 14, monthly: 30 } as const;

function recurringSumWithin(recurring: Recurring[], windowMs: number, now: number): number {
  const horizon = now + windowMs;
  let sum = 0;
  for (const r of recurring) {
    if (!r.active) continue;
    const start = Date.parse(r.nextRunAt);
    if (!Number.isFinite(start)) continue;
    let t = start;
    const step = PERIOD_DAYS[r.period] * 24 * 60 * 60 * 1000;
    while (t <= horizon) {
      sum += r.amount;
      t += step;
    }
  }
  return sum;
}

function giftSumWithin(gifts: Gift[], windowMs: number, now: number): number {
  const horizon = now + windowMs;
  let sum = 0;
  for (const g of gifts) {
    if (!g.unlockAt) continue;
    const t = Date.parse(g.unlockAt);
    if (!Number.isFinite(t)) continue;
    if (t <= horizon) sum += g.amount;
  }
  return sum;
}

export function BalanceProjection({ account }: { account: Account }) {
  const { t } = useI18n();
  const { code } = useCurrency();
  const [recurring, setRecurring] = useState<Recurring[]>([]);
  const [pending, setPending] = useState<Gift[]>([]);
  // Здесь было `const [, setTick] = useState<number>(0)` — счётчик, который
  // увеличивался раз в 5 минут «чтобы горизонты обновлялись». Он НЕ РАБОТАЛ:
  // значение не читалось и не входило в зависимости useMemo ниже, поэтому
  // проекция не пересчитывалась. Инкремент вызывал ререндер, но useMemo
  // возвращал закэшированный результат — от времени первого расчёта.
  //
  // Заменено на само время: оно и подставляется в расчёт (вместо Date.now()
  // внутри useMemo — react-hooks/purity), и стоит в зависимостях, так что
  // пересчёт действительно происходит.
  //
  // Ноль как начальное значение безопасен: при нём горизонт попадает в 1970,
  // суммы выходят нулевыми, hasAnyOut === false и компонент возвращает null —
  // ровно то же, что он делает, когда исходящих платежей нет.
  const [nowMs, setNowMs] = useState<number>(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sync = () => {
      setRecurring(loadRecurring());
      setPending(pendingGifts());
    };
    sync();
    window.addEventListener(GIFTS_EVENT, sync);
    window.addEventListener("focus", sync);
    // Обновляем ВРЕМЯ раз в 5 минут — оно входит в зависимости useMemo, поэтому
    // проекция действительно пересчитывается (раньше счётчик крутился впустую).
    const firstTime = window.setTimeout(() => setNowMs(Date.now()), 0);
    const id = window.setInterval(() => setNowMs(Date.now()), 5 * 60 * 1000);
    return () => {
      window.removeEventListener(GIFTS_EVENT, sync);
      window.removeEventListener("focus", sync);
      window.clearInterval(id);
      window.clearTimeout(firstTime);
    };
  }, []);

  const projections = useMemo(() => {
    const now = nowMs;
    return HORIZONS.map((h) => {
      const giftOut = giftSumWithin(pending, h.ms, now);
      const recurringOut = recurringSumWithin(recurring, h.ms, now);
      const projected = account.balance - giftOut - recurringOut;
      return {
        ...h,
        giftOut,
        recurringOut,
        projected,
        delta: projected - account.balance,
      };
    });
  }, [nowMs, account.balance, pending, recurring]);

  const hasAnyOut = projections.some((p) => p.giftOut + p.recurringOut > 0);
  if (!hasAnyOut) return null;

  const display = (aec: number) => formatCurrency(convertFromAec(aec, code), code);

  return (
    <section
      aria-labelledby="projection-heading"
      style={{
        border: "1px solid rgba(15,23,42,0.08)",
        borderRadius: 12,
        padding: "10px 14px",
        marginBottom: 16,
        background:
          "linear-gradient(135deg, rgba(15,23,42,0.02), rgba(124,58,237,0.03))",
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
      }}
    >
      <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}>
        <span
          aria-hidden="true"
          style={{
            width: 26,
            height: 26,
            borderRadius: 8,
            background: "linear-gradient(135deg, #7c3aed, #0ea5e9)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            fontWeight: 900,
          }}
        >
          ⇢
        </span>
        <div>
          <div
            id="projection-heading"
            style={{ fontSize: 11, fontWeight: 900, color: "#0f172a", letterSpacing: "0.02em" }}
          >
            {t("projection.title")}
          </div>
          <div style={{ fontSize: 10, color: "#64748b" }}>
            {t("projection.subtitle")}
          </div>
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }} />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Pill label={t("projection.now")} value={display(account.balance)} accent="#0f172a" emphasis />
        {projections.map((p) => {
          const negative = p.projected < 0;
          const pressured = !negative && p.delta < -account.balance * 0.5;
          const accent = negative ? "#dc2626" : pressured ? "#d97706" : "#059669";
          const horizonLabel = t(`projection.h.${p.key}`);
          return (
            <Pill
              key={p.key}
              label={horizonLabel}
              value={display(p.projected)}
              accent={accent}
              delta={p.delta}
              hint={
                p.giftOut + p.recurringOut > 0
                  ? `−${display(p.giftOut + p.recurringOut)}` +
                    (p.giftOut > 0 ? ` ${t("projection.hint.gifts", { amt: display(p.giftOut) })}` : "")
                  : undefined
              }
            />
          );
        })}
      </div>
    </section>
  );
}

function Pill({
  label,
  value,
  accent,
  delta,
  hint,
  emphasis,
}: {
  label: string;
  value: string;
  accent: string;
  delta?: number;
  hint?: string;
  emphasis?: boolean;
}) {
  return (
    <div
      title={hint}
      style={{
        padding: "5px 10px",
        borderRadius: 999,
        background: emphasis ? accent : `${accent}15`,
        color: emphasis ? "#fff" : accent,
        border: emphasis ? "none" : `1px solid ${accent}33`,
        fontSize: 11,
        fontWeight: 800,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      <span
        style={{
          fontSize: 9,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          fontWeight: 900,
          opacity: 0.75,
        }}
      >
        {label}
      </span>
      <span style={{ fontFamily: "ui-monospace, monospace" }}>{value}</span>
      {delta !== undefined && delta !== 0 ? (
        <span style={{ fontSize: 10, fontWeight: 700, opacity: 0.8 }}>
          {delta > 0 ? "▲" : "▼"}
        </span>
      ) : null}
    </div>
  );
}
