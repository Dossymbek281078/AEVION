"use client";

import { useState } from "react";
import { gumroadCheckoutUrl } from "@/lib/gumroad";
import { channelFrom, productById, withChannel } from "@/lib/products";
import { track } from "@/lib/track";

// Единственный живой процессинг — Gumroad (Paddle/Stripe/LemonSqueezy не в
// primary). Кнопка ведёт на Gumroad-чекаут. Legacy-имя PaddleUpgradeButton
// реэкспортится из ./PaddleUpgradeButton для старых импортов (~11 модулей).

interface Props {
  /**
   * Tier tag for attribution only — the charge comes from the Gumroad product,
   * not from this value. Defaults to `full`: the banner sells All-Access ("все
   * модули включены"), and `full` is the closest tier label for that. It used to
   * default to `pro` (Universe), which tagged every hand-off with a tier the copy
   * never offered. `pro`/`business` stay accepted for legacy callers.
   */
  tierId?: "full" | "pro" | "business";
  /** "button" — обычная кнопка, "banner" — полоса на всю ширину, "pill" — компактный */
  variant?: "button" | "banner" | "pill";
  /** Название приложения — пробрасывается в Gumroad URL для аналитики атрибуции */
  appId?: string;
  label?: string;
  className?: string;
}

export function UpgradeButton({
  tierId = "full",
  variant = "button",
  appId = "platform",
  label,
  className = "",
}: Props) {
  const [loading, setLoading] = useState(false);
  // The Gumroad All-Access subscription this banner sells.
  const allAccess = productById("xpxzam");

  function handleClick() {
    setLoading(true);
    // Purchase intent from a module page. Without this the funnel dashboard
    // only ever saw checkout_start from the /pricing table, so every upgrade
    // started here (9 module pages) was invisible. track() uses sendBeacon,
    // which survives the navigation below.
    // Метку канала ставит сам track(): она нужна ВСЕМ событиям оплаты, а их
    // отправителей десять. Держать её здесь значило бы завести десятую копию
    // одного механизма — см. пояснение в lib/track.ts.
    track({
      type: "checkout_start",
      tier: tierId,
      source: `upgrade-button/${appId}`,
      meta: { variant, processor: "gumroad" },
    });
    // Gumroad hosted checkout — единственный живой рельс.
    //
    // Метка канала доводится до САМОЙ ОПЛАТЫ, а не только до нашего события.
    // Обработчик оплаты уже умеет её принимать — читает url_params[channel] и
    // url_params[utm_source]. Не хватало отправителя: эта кнопка стоит на
    // девяти страницах модулей и уводила на кассу без метки, то есть про
    // начатую оплату канал был известен, а про оплаченную — нет.
    //
    // Через withChannel, а не своей строкой: у Gumroad отчёт заводится по
    // полной тройке utm, и неполный набор в него не попадает.
    const channel = channelFrom(new URLSearchParams(window.location.search).get("c") ?? undefined);
    window.location.href = withChannel(
      gumroadCheckoutUrl({ key: appId, tier: tierId }),
      channel,
      "upsell",
    );
  }

  const defaultLabel = "Разблокировать всё";
  const text = loading ? "Открываем оплату..." : (label ?? defaultLabel);

  if (variant === "banner") {
    return (
      <div className={`w-full ${className}`}>
        {/* flex-wrap + max-w-full на кнопке: без них баннер уводил страницу вбок на
              телефоне. Кнопке передают длинную подпись ("QStore Pro — безлимитные
              листинги, 14 дней бесплатно"), а shrink-0 запрещал ей ужиматься, и
              она вырастала до 428px при экране 375. Замер живых страниц 27.08.2026,
              ширина документа при экране 375 до -> после этой правки:
              qstore 537->375, qpersona 556->375, psyapp-deps 478->375, healthai 475->375,
              lifebox 572->378, qlearn 451->440. У последних двух остаток НЕ от баннера:
              там есть второй, независимый виновник (lifebox — блок в header шириной 308,
              qlearn — кнопка шириной 112), и чинится он отдельно.
              shrink-0 оставлен намеренно: на широком экране кнопка не должна
              сжиматься рядом с текстом, а max-width:100% там ни на что не влияет.
              sm:flex-nowrap — не украшение, а следствие замера. С одним только
              flex-wrap кнопка уходила на свою строку и НА ШИРОКОМ экране тоже:
              баннер /lifebox рос с 88px до 124px при 1440, 1024 и 768, /qstore —
              при 768. Перенос нужен ровно там, где не помещается, поэтому выше
              640px поведение остаётся прежним, побайтно. */}
        <div className="bg-gradient-to-r from-blue-600/20 to-violet-600/20 border border-blue-500/30 rounded-xl p-4 flex flex-wrap sm:flex-nowrap items-center justify-between gap-4">
          <div>
            {/* This button opens the Gumroad product `xpxzam`, NOT a tier checkout,
                so the price must come from the product catalogue — not from the tier
                registry. $59 is the real Gumroad price, verified against the live
                dashboard on 2026-07-26 (see lib/products.ts). Imported rather than
                typed so it tracks the catalogue. */}
            <div className="text-sm font-semibold text-white">
              AEVION All-Access — ${allAccess?.priceUsd ?? 59}/мес
            </div>
            <div className="text-xs text-gray-400 mt-0.5">Все модули включены · Отмена в любой момент · Карта любого банка</div>
          </div>
          <button
            onClick={handleClick}
            disabled={loading}
            className="shrink-0 max-w-full break-words px-5 py-2 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {text}
          </button>
        </div>
      </div>
    );
  }

  if (variant === "pill") {
    return (
      <span>
        <button
          onClick={handleClick}
          disabled={loading}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 text-xs font-semibold rounded-full transition-colors disabled:opacity-50 ${className}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
          {text}
        </button>
      </span>
    );
  }

  // default: button
  return (
    <span className={`inline-block ${className}`}>
      <button
        onClick={handleClick}
        disabled={loading}
        className="px-6 py-2.5 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
      >
        {text}
      </button>
    </span>
  );
}
