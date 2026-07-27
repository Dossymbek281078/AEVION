"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/apiBase";
import { usePricingT } from "@/lib/pricingI18n";
import { track } from "@/lib/track";
import { getAuthToken } from "@/lib/aevionCatalog";

// Compact pricing chip + one-click buy for module pages. Mirrors the REAL GTM
// tiers (Lite / Medium / Full) from /api/pricing — the same prices the checkout
// actually charges — so what a visitor sees equals what they pay.
//
// "Купить" opens the live LemonSqueezy checkout for Lite + this module: $24/mo,
// "one product of your choice" with full access to it (the backend skips the
// per-module add-on for Lite's chosen module, so the charge is exactly Lite's
// price). "сравнить тарифы →" leads to /pricing?module=<id> with the product
// pre-selected.
//
// Previously this chip read /api/aevion/pricing (an à-la-carte $5/$9/$15 "solo"
// model that has no real checkout SKU) — that advertised a price that was never
// charged. Now it reads the GTM tiers that the checkout/LemonSqueezy flow
// actually bills.
//
// Data: pulls /api/pricing once per page-load and caches the in-flight promise
// at module scope so N chips on one page = 1 request.

type CurrencyCode = "USD" | "EUR" | "KZT" | "RUB";

interface Tier {
  id: string;
  name: string;
  priceMonthly: number | null;
}
interface CurrencyRate {
  rate: number;
  symbol: string;
  label: string;
}
interface PricingModule {
  id: string;
  addonMonthly: number | null;
  availability?: string;
}
interface PricingResponse {
  tiers: Tier[];
  modules?: PricingModule[];
  currencies: Record<CurrencyCode, CurrencyRate>;
}

/**
 * Веерная витрина: что подешевеет, если купить ЭТОТ модуль. Тот же приём, что
 * у Higgsfield — список того, что откроется, показан ДО оплаты (см.
 * docs/FAN_DISCOUNTS_2026-07.md). Числа берём из /api/pricing/fan/preview,
 * ставки на фронте не считаем.
 *
 * Кэш по валюте: preview возвращает суммы уже конвертированными, поэтому один
 * общий promise для всех валют дал бы чужие цифры при переключении тумблера.
 */
interface FanPreviewRow {
  module: string;
  ring1: string[];
  ring1SavingMonthly: number;
}
/**
 * Кэш запроса, который НЕ запоминает неудачу навсегда.
 *
 * 🔴 Найдено вычиткой дифа 2026-07-27. Оба кэша ниже клали промис в память до
 * того, как он разрешится, и больше никогда не перезапрашивали. Один сетевой
 * сбой или холодный старт бэкенда — и `null` оставался в кэше на всю жизнь
 * страницы: веерная строка не появлялась уже никогда, а у `loadPricing`
 * пропадала и сама цена. Перерисовка компонента не помогала, помогала только
 * перезагрузка вкладки — то есть человек видел «скидки нет» из-за нашей
 * ошибки, ровно тот же тупик, что уже чинился в FanDiscountPanel.
 *
 * Почему кулдаун, а не «просто не кэшировать неудачу»: на странице бывает
 * несколько чипов, и мгновенный перезапрос каждым из них превратил бы лежачий
 * бэкенд в шторм. Тот же приём применён на сервере в discountIntegrityLog.
 */
const FAILED_RETRY_MS = 30_000;

function cachedFetch<T>(
  store: Map<string, Promise<T | null>>,
  key: string,
  run: () => Promise<T | null>,
): Promise<T | null> {
  const cached = store.get(key);
  if (cached) return cached;
  const p = run()
    .catch(() => null)
    .then((v) => {
      // Успех держим; неудачу забываем через кулдаун, чтобы следующий
      // рендер попробовал снова, а не наследовал чужой сбой.
      if (v === null) setTimeout(() => store.delete(key), FAILED_RETRY_MS);
      return v;
    });
  store.set(key, p);
  return p;
}

/**
 * ЛИЧНЫЙ веер вошедшего покупателя (в отличие от витрины `fan/preview` выше).
 *
 * Зачем: до 2026-07-27 покупатель с уже открытым веером, зайдя на страницу
 * модуля, не видел СВОЮ скидку — чип показывал только общее «купи этот,
 * подешевеют те». То есть человек, который вероятнее всего купит, на странице
 * решения не получал никакого сигнала.
 *
 * `discount.honouredByDefault` приходит из того же правила, что у чекаута
 * (`channelHonoursAmount`): если канал по умолчанию спишет цену продукта, а не
 * нашу сумму, личную цену показывать НЕЛЬЗЯ — вместо неё говорим, где скидка
 * реально применится. Обещание, которое не выполнит счёт, — тот самый дефект,
 * с которого началась эта ветка.
 */
interface FanMeOffer {
  module: string;
  discountPercent: number;
  priceMonthly: number;
  listMonthly: number;
}
interface FanMe {
  status: string;
  validUntil: string | null;
  offers?: FanMeOffer[];
  discount?: { honouredByDefault: boolean; honouredVia: string[] };
}

const fanPromises = new Map<string, Promise<FanPreviewRow[] | null>>();
const pricingPromises = new Map<string, Promise<PricingResponse | null>>();
const fanMePromises = new Map<string, Promise<FanMe | null>>();

function loadFanMe(token: string): Promise<FanMe | null> {
  return cachedFetch(fanMePromises, token.slice(0, 24), () =>
    fetch(apiUrl("/api/pricing/fan/me"), { headers: { Authorization: `Bearer ${token}` } }).then((r) =>
      r.ok ? (r.json() as Promise<FanMe>) : null,
    ),
  );
}

function loadFanPreview(currency: CurrencyCode): Promise<FanPreviewRow[] | null> {
  return cachedFetch(fanPromises, currency, () =>
    fetch(apiUrl(`/api/pricing/fan/preview?currency=${encodeURIComponent(currency)}`))
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => (Array.isArray(j?.items) ? (j.items as FanPreviewRow[]) : null)),
  );
}

function loadPricing(): Promise<PricingResponse | null> {
  return cachedFetch(pricingPromises, "pricing", () =>
    fetch(apiUrl("/api/pricing")).then((r) => (r.ok ? r.json() : null)),
  );
}

function fmt(usd: number, code: CurrencyCode, rates: Record<CurrencyCode, CurrencyRate>): string {
  const r = rates?.[code] ?? rates?.USD ?? { rate: 1, symbol: "$", label: "USD" };
  const raw = usd * r.rate;
  if (code === "USD" || code === "EUR") return `${r.symbol}${Math.round(raw * 100) / 100}`;
  return `${Math.round(raw).toLocaleString("ru-RU")} ${r.symbol}`;
}

interface Props {
  moduleId: string;
  currency?: CurrencyCode;
  /** Optional dark/light theme (defaults to light). */
  theme?: "light" | "dark";
  /** Hide the one-click buy button (chip stays informational). Default false. */
  hideBuy?: boolean;
}

export default function ModulePricingChip({ moduleId, currency = "USD", theme = "light", hideBuy = false }: Props) {
  const tp = usePricingT();
  const [data, setData] = useState<PricingResponse | null>(null);
  const [fanRow, setFanRow] = useState<FanPreviewRow | null>(null);
  const [mine, setMine] = useState<{ offer: FanMeOffer; honoured: boolean; validUntil: string | null } | null>(null);
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadPricing().then((d) => {
      if (!cancelled) setData(d);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Личный веер — только для вошедшего. Без токена молчим: придумывать скидку
  // «наверное, есть» нельзя, это обещание, которое чекаут не выполнит.
  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;
    let cancelled = false;
    loadFanMe(token).then((me) => {
      if (cancelled || !me || me.status !== "active") return;
      const offer = me.offers?.find((o) => o.module === moduleId && o.discountPercent > 0);
      if (!offer) return;
      setMine({
        offer,
        honoured: me.discount?.honouredByDefault === true,
        validUntil: me.validUntil ?? null,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [moduleId]);

  useEffect(() => {
    let cancelled = false;
    loadFanPreview(currency).then((rows) => {
      if (cancelled) return;
      const row = rows?.find((r) => r.module === moduleId) ?? null;
      setFanRow(row);
      // Одно событие на показ веерной строки конкретной витрины. Без него не
      // узнать, КАКАЯ витрина заводит веер: панель на /pricing размечена, а 28
      // страниц модулей молчали. Считается видимостью, не кликом.
      if (row && row.ring1.length > 0) {
        track({
          type: "fan_view",
          source: `module-chip/${moduleId}`,
          meta: { module: moduleId, ring1: row.ring1.length, saving: row.ring1SavingMonthly },
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [currency, moduleId]);

  if (!data || !Array.isArray(data.tiers)) return null;

  const findTier = (id: string) => data.tiers.find((t) => t.id === id);
  const lite = findTier("lite");
  const medium = findTier("medium");
  const full = findTier("full");
  // Lite is the entry the buy button charges — without it there's nothing to show.
  if (!lite || lite.priceMonthly == null) return null;

  const palette =
    theme === "dark"
      ? { bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.12)", text: "#e2e8f0", muted: "#94a3b8", accent: "#34d399" }
      : { bg: "#f8fafc", border: "rgba(15,23,42,0.08)", text: "#0f172a", muted: "#64748b", accent: "#0d9488" };

  const litePrice = fmt(lite.priceMonthly, currency, data.currencies);

  // Модули без à-la-carte цены (addonMonthly: null — 8 из 43) купить поштучно
  // нельзя ничем; витрина про это молчала. Даём явный запрос цены — он уходит
  // лидом с названием модуля (/api/pricing/lead), т.е. спрос становится видимым
  // вместо того, чтобы теряться. См. docs/FAN_DISCOUNTS_2026-07.md §6.
  const thisModule = data.modules?.find((m) => m.id === moduleId);
  const quoteOnRequest = thisModule ? thisModule.addonMonthly === null : false;

  // One-click checkout: Lite tier + this module → live LemonSqueezy hosted page.
  // The backend /checkout/session picks the processor (LS primary → Gumroad →
  // stub), treats this module as Lite's "one of choice" (no add-on), and returns
  // a ready checkout URL. Email is collected on the hosted page.
  async function buyNow() {
    setBuying(true);
    setBuyError(false);
    try {
      const r = await fetch(apiUrl("/api/pricing/checkout/session"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tierId: "lite", period: "monthly", seats: 1, modules: [moduleId] }),
      });
      const j = await r.json();
      if (j?.url) {
        window.location.href = j.url;
        return; // keep the spinner while the browser navigates away
      }
      setBuyError(true);
      setBuying(false);
    } catch {
      setBuyError(true);
      setBuying(false);
    }
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: "6px 8px 6px 12px",
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        borderRadius: 999,
        fontSize: 12,
        color: palette.text,
        lineHeight: 1.4,
      }}
    >
      <Link
        href={`/pricing?module=${encodeURIComponent(moduleId)}`}
        style={{ display: "inline-flex", alignItems: "center", gap: 8, color: palette.text, textDecoration: "none" }}
        title="Сравнить тарифы — Lite, Medium, Full"
      >
        <span><strong style={{ fontWeight: 800 }}>{litePrice}</strong>/мес · <span translate="no">Lite</span></span>
        {medium && medium.priceMonthly != null && (
          <>
            <span style={{ color: palette.muted }}>·</span>
            <span><span translate="no">Medium</span> {fmt(medium.priceMonthly, currency, data.currencies)}</span>
          </>
        )}
        {full && full.priceMonthly != null && (
          <>
            <span style={{ color: palette.muted }}>·</span>
            <span style={{ color: palette.accent, fontWeight: 700 }}>
              Полный доступ {fmt(full.priceMonthly, currency, data.currencies)}
            </span>
          </>
        )}
      </Link>
      {/* Веер: только когда покупка реально что-то открывает. Модуль-одиночка
          (lifebox/constitution — их соседи по кластеру пока без цены) не
          получает бодрую строку «веер 0» — пустое обещание хуже молчания. */}
      {quoteOnRequest && (
        <Link
          href={`/pricing/contact?module=${encodeURIComponent(moduleId)}`}
          style={{ color: palette.accent, fontWeight: 800, textDecoration: "none", whiteSpace: "nowrap" }}
          title={tp("fan.quote.tooltip", { module: moduleId })}
        >
          {tp("fan.quote.cta")}
        </Link>
      )}
      {/*
        Личный веер вытесняет общую витрину: покупателю с открытым окном важнее
        своя цена, чем «что откроется, если купишь». Два состояния и оба честные:
        скидку списывают — называем цену; не списывают — называем скидку и
        канал, где она применится, но НЕ пишем цену, которой не будет в счёте.
      */}
      {!quoteOnRequest && mine && (
        <span
          style={{ color: palette.accent, fontWeight: 800, whiteSpace: "nowrap" }}
          title={
            mine.validUntil
              ? tp("fan.mine.tooltip", { until: new Date(mine.validUntil).toLocaleDateString("ru-RU") })
              : undefined
          }
        >
          {mine.honoured
            ? tp("fan.mine.price", {
                pct: mine.offer.discountPercent,
                price: fmt(mine.offer.priceMonthly, currency, data.currencies),
                list: fmt(mine.offer.listMonthly, currency, data.currencies),
              })
            : tp("fan.mine.pending", { pct: mine.offer.discountPercent })}
        </span>
      )}
      {!quoteOnRequest && !mine && fanRow && fanRow.ring1.length > 0 && (
        <span
          style={{ color: palette.accent, fontWeight: 700, whiteSpace: "nowrap" }}
          title={tp("fan.module.tooltip", { module: moduleId, list: fanRow.ring1.join(", ") })}
        >
          {tp("fan.module.opens", {
            n: fanRow.ring1.length,
            cur: (data.currencies?.[currency] ?? data.currencies?.USD)?.symbol ?? "$",
            sum: fanRow.ring1SavingMonthly,
          })}
        </span>
      )}
      {!hideBuy && (
        <button
          type="button"
          onClick={buyNow}
          disabled={buying}
          title={buyError ? "Ошибка — попробуйте ещё раз" : `Купить Lite ${litePrice}/мес — этот продукт, оплата картой`}
          style={{
            border: "none",
            cursor: buying ? "wait" : "pointer",
            padding: "6px 14px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 800,
            whiteSpace: "nowrap",
            color: "#fff",
            background: buyError ? "#dc2626" : "linear-gradient(135deg, #0d9488, #0ea5e9)",
            opacity: buying ? 0.7 : 1,
          }}
        >
          {buying ? "Открываем…" : buyError ? "Повторить" : "Купить"}
        </button>
      )}
    </span>
  );
}
