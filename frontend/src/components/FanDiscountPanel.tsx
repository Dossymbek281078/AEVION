"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { apiUrl } from "@/lib/apiBase";
import { usePricingT } from "@/lib/pricingI18n";
import { useI18n } from "@/lib/i18n";
import { track } from "@/lib/track";
import { getAuthToken } from "@/lib/aevionCatalog";

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
  /** Ключ последнего отправленного fan_view — защита от дублей на ререндерах. */
  const viewedRef = useRef<string | null>(null);
  /** Веер авторизованного покупателя: пришёл с сервера, ручной выбор не нужен. */
  const [mine, setMine] = useState<FanState | null>(null);
  /** true — база покупок приложений недоступна, список модулей может быть неполным. */
  const [appsUnavailable, setAppsUnavailable] = useState(false);

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

  // Авторизованный покупатель не должен вручную отмечать то, что мы про него
  // знаем: /fan/me читает и подписки, и поштучные покупки (lib/ownedModules.ts).
  // Ручной выбор остаётся для гостя — это витрина «что будет, если купить».
  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;
    let alive = true;

    /**
     * Своя покупка — данные, за которые стоит попробовать дважды.
     *
     * Замерено в живом прогоне 2026-07-26: первый запрос после старта бэкенда
     * может вернуть `appsSource: "unavailable"` (холодный пул Postgres). Раньше
     * панель на этом залипала НАВСЕГДА: веер пустой, а ручной выбор скрыт,
     * потому что `mine` уже не null — покупатель оставался в тупике без
     * единого способа увидеть скидку. Теперь: одна повторная попытка, а если и
     * она без данных — `mine` НЕ выставляется, и человек видит обычную витрину
     * с ручным выбором. Тупика быть не должно ни при какой ошибке.
     */
    const load = async (attempt: number): Promise<void> => {
      try {
        const r = await fetch(apiUrl("/api/pricing/fan/me"), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) return;
        const j = await r.json();
        if (!alive || !j) return;
        const incomplete = j.appsSource === "unavailable";
        if (incomplete && attempt === 1) {
          await new Promise((res) => setTimeout(res, 600));
          return load(2);
        }
        if (incomplete) setAppsUnavailable(true);
        // Пустой веер при неполных данных не выдаём за факт: пусть человек
        // подберёт вручную, чем смотрит на «скидок нет» из-за нашей ошибки.
        const hasSomething = Array.isArray(j.offers) && (j.ownedPaid?.length ?? 0) > 0;
        if (hasSomething) setMine(j as FanState);
      } catch {
        /* сеть — тихо, витрина с ручным выбором остаётся доступной */
      }
    };
    void load(1);

    return () => {
      alive = false;
    };
  }, []);

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
      .then((j) => {
        if (!alive) return;
        const state = j as FanState;
        setFan(state);
        // Одно событие на состояние веера, а не на каждый ререндер: ключ из
        // уровня и числа скидок, чтобы повторный показ того же не дублировался.
        const key = `${state.status}:${state.level}:${state.summary?.discounted ?? 0}`;
        if (viewedRef.current !== key) {
          viewedRef.current = key;
          track({
            type: "fan_view",
            source: "pricing/fan-panel",
            meta: {
              status: state.status,
              level: state.level,
              discounted: state.summary?.discounted ?? 0,
              owned: state.ownedPaid?.length ?? 0,
            },
          });
        }
      })
      .catch((e) => alive && setError(String(e)));
    return () => {
      alive = false;
    };
  }, [owned, currency]);

  /** Свой веер приоритетнее ручного подбора: это факт, а не гипотеза. */
  const shown = mine ?? fan;
  const sym = SYMBOL[currency];
  const starters = useMemo(() => (preview ?? []).slice(0, 6), [preview]);
  const discounted = useMemo(() => (shown?.offers ?? []).filter((o) => o.discountPercent > 0), [shown]);

  function toggle(id: string) {
    setOwned((prev) => {
      const on = prev.includes(id);
      track({ type: "fan_owned_pick", source: "pricing/fan-panel", meta: { module: id, on: !on } });
      return on ? prev.filter((x) => x !== id) : [...prev, id];
    });
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
        {tp("fan.subtitle", { days: shown?.windowDays ?? 14 })}
      </p>

      {error && (
        <div style={{ marginTop: 16, padding: 12, background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, fontSize: 13 }}>
          {tp("fan.error", { reason: error })}
        </div>
      )}

      {/* Витрина до покупки */}
      {!preview && !error && <div style={{ marginTop: 20, color: "#64748b", fontSize: 14 }}>{tp("fan.loading")}</div>}
      {/* Ручной подбор — только для гостя. Своему покупателю мы не задаём
          вопросов, ответ на которые уже есть на сервере. */}
      {preview && !mine && (
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
      {shown && (
        <div style={{ marginTop: 24 }}>
          {appsUnavailable && (
            <div
              style={{
                marginBottom: 12, padding: "8px 12px", borderRadius: 8,
                background: "#fef3c7", border: "1px solid #f59e0b",
                fontSize: 12.5, color: "#78350f",
              }}
            >
              {tp("fan.appsUnavailable")}
            </div>
          )}
          <div style={{ fontSize: 13, color: "#334155", fontWeight: 700 }}>
            {tp("fan.level", { n: shown.level })} · {tp("fan.discountedCount", { n: shown.summary.discounted })} ·{" "}
            {tp("fan.maxSaving", { cur: sym, sum: shown.summary.maxSavingMonthly })}
            {shown.validUntil && (
              <span style={{ fontWeight: 500, color: "#64748b" }}>
                {" "}· {tp("fan.openUntil", { date: new Date(shown.validUntil).toLocaleDateString(locale) })}
              </span>
            )}
          </div>

          {discounted.length === 0 && (
            <div style={{ marginTop: 12, fontSize: 14, color: "#64748b" }}>
              {tp("fan.empty")}
            </div>
          )}

          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
            {/* Каждое предложение — путь к покупке, а не строка в таблице:
                клик ведёт на /pricing с предвыбранным модулем (тот же deep-link,
                что у витрин модулей). Мёртвый список скидок не продаёт. */}
            {discounted.map((o) => (
              <a
                key={o.module}
                href={`/pricing?module=${encodeURIComponent(o.module)}`}
                onClick={() =>
                  track({
                    type: "fan_offer_click",
                    source: "pricing/fan-panel",
                    value: o.priceMonthly,
                    meta: { module: o.module, ring: o.ring, percent: o.discountPercent },
                  })
                }
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "10px 14px",
                  background: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  textDecoration: "none",
                  color: "inherit",
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
              </a>
            ))}
          </div>

          <p style={{ marginTop: 12, fontSize: 12, color: "#64748b" }}>
            {tp("fan.footnote")}{" "}
            <a
              href="/pricing/refund-policy#fan"
              onClick={() => track({ type: "fan_terms_open", source: "pricing/fan-panel" })}
              style={{ color: "#0f766e", fontWeight: 700 }}
            >
              {tp("fan.termsLink")}
            </a>
          </p>
        </div>
      )}
    </section>
  );
}

export default FanDiscountPanel;
