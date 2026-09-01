"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/apiBase";
import { track } from "@/lib/track";
import { withChannel } from "@/lib/products";
import { channelNow } from "@/lib/channelNow";

// Compact pricing chip + one-click buy for module pages. Mirrors the REAL GTM
// tiers (Lite / Medium / Full) from /api/pricing — the same prices the checkout
// actually charges — so what a visitor sees equals what they pay.
//
// "Купить" opens the live LemonSqueezy checkout for Lite + this module: $19/mo,
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
interface PricingResponse {
  tiers: Tier[];
  currencies: Record<CurrencyCode, CurrencyRate>;
}

// Module-scoped cache: first chip on the page triggers the fetch, every
// subsequent chip reuses the same promise. Survives chip-mount churn.
let pricingPromise: Promise<PricingResponse | null> | null = null;

function loadPricing(): Promise<PricingResponse | null> {
  if (!pricingPromise) {
    pricingPromise = fetch(apiUrl("/api/pricing"))
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
  }
  return pricingPromise;
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
  const [data, setData] = useState<PricingResponse | null>(null);
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

  /*
   * ⚠️ Стоит ЗДЕСЬ, до первого раннего возврата: хук после `return null`
   * даёт «Rendered more hooks than during the previous render» — компонент
   * падает у всех 37 модулей. Поймал собственный тест, глазами не видно.
   *
   * 🔴 ПОКУПКА ВТОРОЙ РАЗ НЕ ДОЛЖНА ДАВАТЬ МЕНЬШЕ, ЧЕМ БЫЛО (01.09.2026).
   *
   * Кнопка жёстко оформляет тариф Lite: `tierId: "lite"`. Она стоит на 37
   * страницах модулей и НИ РАЗУ не спрашивала, какой тариф у человека.
   *
   * Замер соседнего окна на сквозном стенде (настоящий вебхук, настоящий файл
   * подписок, настоящая функция стены):
   *
   *     купил medium              -> medium
   *     затем «докупил модуль»    -> LITE
   *
   * Для кассы «докупить модуль» и «перейти на Lite» — одно событие: ссылка
   * заказа собирается как `tier_<id>_<период>`. То есть человек платил второй
   * раз и получал МЕНЬШЕ доступа, чем имел, молча — ни предупреждения, ни следа.
   *
   * ⚠️ Чиню НЕ ценой и НЕ составом пакетов: это решение основателя. Убираю
   * ровно вред — предложение, которое понижает. Кто уже платит больше Lite,
   * видит не «Купить», а путь к своему тарифу.
   *
   * Незнание трактуется в пользу покупки: гость и человек без входа обязаны
   * иметь возможность купить. Молчание сервера не должно закрывать кассу.
   */
  const [ownTier, setOwnTier] = useState<string | null>(null);

  useEffect(() => {
    let живо = true;
    fetch(apiUrl("/api/me/entitlements"), { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (живо) setOwnTier(typeof d?.plan === "string" ? d.plan.toLowerCase() : null);
      })
      .catch(() => {});
    return () => {
      живо = false;
    };
  }, []);

  // Порядок тарифов ровно тот, что у стены на сервере. Незнакомое значение —
  // ноль: неизвестный тариф не повод запрещать покупку.
  const RANK: Record<string, number> = { free: 0, lite: 1, medium: 2, full: 3, pro: 4, enterprise: 5 };
  const покупкаПонизит = (RANK[ownTier ?? ""] ?? 0) > RANK.lite;
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

  // One-click checkout: Lite tier + this module → live LemonSqueezy hosted page.
  // The backend /checkout/session picks the processor (LS primary → Gumroad →
  // stub), treats this module as Lite's "one of choice" (no add-on), and returns
  // a ready checkout URL. Email is collected on the hosted page.

  async function buyNow() {
    setBuying(true);
    setBuyError(false);
    // Same event the /pricing table fires, so the funnel dashboard counts a
    // module-page purchase intent instead of silently missing it. sendBeacon
    // inside track() survives the redirect to the processor.
    track({
      type: "checkout_start",
      tier: "lite",
      source: `module-chip/${moduleId}`,
      meta: { period: "monthly", seats: 1, modules: 1, module: moduleId },
    });
    try {
      const r = await fetch(apiUrl("/api/pricing/checkout/session"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tierId: "lite", period: "monthly", seats: 1, modules: [moduleId] }),
      });
      const j = await r.json();
      if (j?.url) {
        // Метка канала доводится до САМОЙ КАССЫ, а не только до нашего события.
        //
        // Найдено 31.08.2026 обходом пути покупателя в браузере: эта кнопка —
        // ТРЕТИЙ путь оплаты, мимо обоих, что чинились накануне. Она не строит
        // адрес сама, а получает готовый от бэкенда и уходит по нему как есть.
        //
        // Получатель давно готов: вебхук LemonSqueezy читает
        // custom_data.channel (заведено 19.08.2026), а вебхук Gumroad —
        // url_params[channel]. Не хватало отправителя, и покупка приходила в
        // отчёт ниоткуда. withChannel сам знает обе кассы и подставляет нужную
        // форму параметра.
        const mark = channelNow();
        window.location.href = withChannel(j.url, mark, "module-chip");
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
    // flexWrap + maxWidth: чип стоит в шапке модуля рядом с логотипом, и без
    // переноса он не давал шапке сложиться на телефоне — страница ехала вбок.
    // Замер 27.08.2026 при экране 375: /lifebox чип 231px -> 203px, документ
    // 572 -> 375 (вместе с починкой баннера в UpgradeButton.tsx).
    // Чип общий для 37 модульных страниц, поэтому правка здесь, а не в каждой
    // шапке: соседняя вкладка (deploy/mobile-fixes-2026-08-27, коммит 7bdc947a1)
    // чинит шапки по одной, и эти две правки складываются, не конфликтуя.
    <span
      style={{
        display: "inline-flex",
        flexWrap: "wrap",
        maxWidth: "100%",
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
        style={{ display: "inline-flex", flexWrap: "wrap", maxWidth: "100%", alignItems: "center", gap: 8, color: palette.text, textDecoration: "none" }}
        title="Сравнить тарифы — Lite, Medium, Full"
      >
        <span><strong style={{ fontWeight: 800 }}>{litePrice}</strong>/мес · <span translate="no" className="notranslate">{lite.name || "Lite"}</span></span>
        {medium && medium.priceMonthly != null && (
          <>
            <span style={{ color: palette.muted }}>·</span>
            <span><span translate="no" className="notranslate">{medium.name || "Medium"}</span> {fmt(medium.priceMonthly, currency, data.currencies)}</span>
          </>
        )}
        {full && full.priceMonthly != null && (
          <>
            <span style={{ color: palette.muted }}>·</span>
            {/* Имя тарифа — из /api/pricing, тем же словом, что на кассе и в
                письме. Подпись «Полный доступ» была четвёртым названием той же
                строки: человек искал «Full», а на витрине его не было. */}
            <span style={{ color: palette.accent, fontWeight: 700 }}>
              <span translate="no" className="notranslate">{full.name || "Full"}</span> {fmt(full.priceMonthly, currency, data.currencies)}
            </span>
          </>
        )}
      </Link>
      {/*
        Покупателю, у которого тариф ВЫШЕ Lite, кнопка не показывается: она
        оформила бы Lite и понизила его. Вместо неё — путь к своему тарифу.
        Это не «спрятать кассу»: человек уже платит больше, продавать ему
        меньшее за деньги нечестно.
      */}
      {!hideBuy && покупкаПонизит && (
        <Link
          href="/account"
          title="У вас тариф выше Lite — эта кнопка оформила бы Lite и понизила доступ"
          style={{
            padding: "6px 14px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 800,
            whiteSpace: "nowrap",
            textDecoration: "none",
            color: palette.muted,
            border: `1px solid ${palette.border}`,
          }}
        >
          Уже включено
        </Link>
      )}
      {!hideBuy && !покупкаПонизит && (
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
