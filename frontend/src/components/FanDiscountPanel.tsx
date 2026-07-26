"use client";

import { useEffect, useMemo, useState } from "react";
import { apiUrl } from "@/lib/apiBase";
import { usePricingT } from "@/lib/pricingI18n";
import { useI18n } from "@/lib/i18n";

/**
 * Веерная скидка — панель для /pricing.
 *
 * Показывает механику до покупки («купи один — вот что подешевеет») и после
 * («вот твой веер и до какого числа он открыт»). Числа НЕ считаются на фронте:
 * всё приходит из POST /api/pricing/fan — того же движка, который применяет
 * скидку в смете и в чекауте (data/fanDiscounts.ts). Дублировать ставки здесь
 * нельзя: фронт и бэкенд разъедутся, а разъехавшаяся цена — это цена, которую
 * пользователю обещали и не дали.
 *
 * apiUrl() зовём только в useEffect: вызов на рендере ломает гидрацию
 * (React #418) — грабли уже ловили на этом проекте.
 *
 * Весь копирайт — через usePricingT() (секция `fan` в
 * lib/pricingI18n/sections/fan.ts). Хардкод RU здесь = KK/EN-переключатель
 * переводит страницу частично, ровно как было в `constitution`.
 */

type CurrencyCode = "USD" | "EUR" | "KZT" | "RUB";

interface FanOffer {
  module: string;
  ring: 1 | 2 | 3;
  anchor: string | null;
  reason: string;
  listMonthly: number;
  discountPercent: number;
  priceMonthly: number;
  savingMonthly: number;
  availability: string;
  cogsCapped: boolean;
}

interface FanState {
  status: "active" | "expired" | "inactive";
  level: number;
  ownedPaid: string[];
  windowDays: number;
  validUntil: string | null;
  ringRatios: Record<"1" | "2" | "3", number>;
  offers: FanOffer[];
  summary: { ring1: number; ring2: number; ring3: number; discounted: number; maxSavingMonthly: number };
  notes: string[];
}

interface PreviewRow {
  module: string;
  listMonthly: number;
  ring1: string[];
  ring2Count: number;
  ring3Count: number;
  ring1SavingMonthly: number;
}

const SYMBOL: Record<CurrencyCode, string> = { USD: "$", EUR: "€", KZT: "₸", RUB: "₽" };

export function FanDiscountPanel({ currency = "USD" }: { currency?: CurrencyCode }) {
  const tp = usePricingT();
  const { lang } = useI18n();
  // Дата окна веера — в локали интерфейса, а не всегда ru-RU.
  const locale = lang === "ru" ? "ru-RU" : "en-US";
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [owned, setOwned] = useState<string[]>([]);
  const [fan, setFan] = useState<FanState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(apiUrl(`/api/pricing/fan/preview?currency=${currency}`))
      .then((r) => r.json())
      .then((j) => alive && setPreview(Array.isArray(j.items) ? j.items : []))
      .catch((e) => alive && setError(String(e)));
    return () => {
      alive = false;
    };
  }, [currency]);

  useEffect(() => {
    if (owned.length === 0) {
      setFan(null);
      return;
    }
    let alive = true;
    fetch(apiUrl("/api/pricing/fan"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ owned, currency }),
    })
      .then((r) => r.json())
      .then((j) => alive && setFan(j as FanState))
      .catch((e) => alive && setError(String(e)));
    return () => {
      alive = false;
    };
  }, [owned, currency]);

  const sym = SYMBOL[currency];
  const starters = useMemo(() => (preview ?? []).slice(0, 6), [preview]);
  const discounted = useMemo(() => (fan?.offers ?? []).filter((o) => o.discountPercent > 0), [fan]);

  function toggle(id: string) {
    setOwned((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <section
      style={{
        margin: "48px auto 0",
        maxWidth: 980,
        padding: "24px 28px",
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: 16,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 800, color: "#0d9488", letterSpacing: "0.04em", textTransform: "uppercase" }}>
        {tp("fan.badge")}
      </div>
      <h2 style={{ margin: "6px 0 4px", fontSize: 24, fontWeight: 900, color: "#0f172a" }}>
        {tp("fan.title")}
      </h2>
      <p style={{ margin: 0, fontSize: 14, color: "#475569", maxWidth: 720 }}>
        {tp("fan.subtitle", { days: fan?.windowDays ?? 14 })}
      </p>

      {error && (
        <div style={{ marginTop: 16, padding: 12, background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, fontSize: 13 }}>
          {tp("fan.error", { reason: error })}
        </div>
      )}

      {/* Витрина до покупки */}
      {!preview && !error && <div style={{ marginTop: 20, color: "#64748b", fontSize: 14 }}>{tp("fan.loading")}</div>}
      {preview && (
        <>
          <h3 style={{ margin: "24px 0 8px", fontSize: 13, fontWeight: 800, color: "#334155", textTransform: "uppercase", letterSpacing: "0.03em" }}>
            {tp("fan.pick")}
          </h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {starters.map((row) => {
              const on = owned.includes(row.module);
              return (
                <button
                  key={row.module}
                  onClick={() => toggle(row.module)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 999,
                    border: on ? "1px solid #0d9488" : "1px solid #cbd5e1",
                    background: on ? "#0d9488" : "#fff",
                    color: on ? "#fff" : "#0f172a",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                  title={tp("fan.chip.tooltip", { module: row.module, n: row.ring1.length })}
                >
                  {row.module}
                  <span style={{ fontWeight: 500, opacity: 0.75 }}>
                    {" "}· {sym}
                    {row.listMonthly} · {tp("fan.chip.opens", { n: row.ring1.length })}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Результат веера */}
      {fan && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 13, color: "#334155", fontWeight: 700 }}>
            {tp("fan.level", { n: fan.level })} · {tp("fan.discountedCount", { n: fan.summary.discounted })} ·{" "}
            {tp("fan.maxSaving", { cur: sym, sum: fan.summary.maxSavingMonthly })}
            {fan.validUntil && (
              <span style={{ fontWeight: 500, color: "#64748b" }}>
                {" "}· {tp("fan.openUntil", { date: new Date(fan.validUntil).toLocaleDateString(locale) })}
              </span>
            )}
          </div>

          {discounted.length === 0 && (
            <div style={{ marginTop: 12, fontSize: 14, color: "#64748b" }}>
              {tp("fan.empty")}
            </div>
          )}

          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
            {discounted.map((o) => (
              <div
                key={o.module}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "10px 14px",
                  background: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>{o.module}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    {tp(`fan.ring.${o.ring}`)} — {o.reason}
                    {o.cogsCapped && ` · ${tp("fan.cogsCapped")}`}
                  </div>
                </div>
                <div style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                  <span style={{ fontSize: 13, color: "#94a3b8", textDecoration: "line-through" }}>
                    {sym}
                    {o.listMonthly}
                  </span>{" "}
                  <span style={{ fontSize: 16, fontWeight: 900, color: "#0f172a" }}>
                    {sym}
                    {o.priceMonthly}
                  </span>
                  <span
                    style={{
                      marginLeft: 8,
                      padding: "2px 6px",
                      borderRadius: 6,
                      background: "#ccfbf1",
                      color: "#0f766e",
                      fontSize: 11,
                      fontWeight: 800,
                    }}
                  >
                    −{o.discountPercent}%
                  </span>
                </div>
              </div>
            ))}
          </div>

          <p style={{ marginTop: 12, fontSize: 12, color: "#64748b" }}>
            {tp("fan.footnote")}{" "}
            <a href="/pricing/refund-policy#fan" style={{ color: "#0f766e", fontWeight: 700 }}>
              {tp("fan.termsLink")}
            </a>
          </p>
        </div>
      )}
    </section>
  );
}

export default FanDiscountPanel;
