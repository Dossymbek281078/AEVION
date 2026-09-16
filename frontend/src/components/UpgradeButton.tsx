"use client";

import { useState } from "react";
import { PRICING_TERMS, keepChannel, productById } from "@/lib/products";
import { fromPricePerMonth } from "@/lib/termPricing";
import { channelNow } from "@/lib/channelNow";
import { track } from "@/lib/track";

// Кнопка апселла на страницах модулей. Legacy-имя PaddleUpgradeButton
// реэкспортится из ./PaddleUpgradeButton для старых импортов (~11 модулей).
//
// ⚠️ 15.09.2026 — новая ценовая политика: подписка AEVION — это СРОК доступа ко
// всей планете (1–12 месяцев), оплата за срок вперёд. Прежде баннер продавал
// All-Access на Gumroad, товар снят с продажи. Теперь кнопка ведёт на страницу
// цен, к выбору срока: там же и касса. Прямой ссылки в кассу на новую лестницу
// нет (товары ещё заводятся в магазине), поэтому здесь её и не выдумываем.

/** Подписка на всю планету — карточка каталога, из неё и цена, и адрес. */
const PLANET_ID = "aevion-planet";

interface Props {
  /**
   * Метка для аналитики, на цену не влияет. Прежние значения (`full`, `pro`,
   * `business`) принимаются, чтобы не трогать страницы, которые их передают.
   */
  tierId?: string;
  /** "button" — обычная кнопка, "banner" — полоса на всю ширину, "pill" — компактный */
  variant?: "button" | "banner" | "pill";
  /** Название приложения — едет в событие аналитики, чтобы видеть, откуда пришли */
  appId?: string;
  label?: string;
  className?: string;
}

export function UpgradeButton({
  tierId,
  variant = "button",
  appId = "platform",
  label,
  className = "",
}: Props) {
  const [loading, setLoading] = useState(false);
  const planet = productById(PLANET_ID);

  function handleClick() {
    setLoading(true);
    // Нажатие апселла — намерение, а не начало оплаты: оплата начнётся на
    // /pricing, и там своё событие checkout_start. Слать его и здесь значило
    // бы считать одну покупку дважды.
    track({
      type: "cta_click",
      tier: tierId,
      source: `upgrade-button/${appId}`,
      meta: { variant, target: "pricing" },
    });
    // Метка канала едет короткой ?c= до ХЕША — страница цен читает её через
    // channelNow и доводит до кассы. keepChannel ставит её в правильное место.
    window.location.href = keepChannel(planet?.href ?? PRICING_TERMS, channelNow());
  }

  const defaultLabel = "Выбрать срок";
  const text = loading ? "Открываем цены..." : (label ?? defaultLabel);

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
            {/* Цена — только из каталога и лестницы сроков (@/lib/termPricing),
                не литералом: баннер годами показывал число, которого касса не
                списывала. «от» — это месяц на самом длинном сроке (12 месяцев). */}
            {planet ? (
              <div className="text-sm font-semibold text-white">
                {planet.title} — от ${fromPricePerMonth(planet.priceUsd)}/мес
              </div>
            ) : null}
            <div className="text-xs text-gray-400 mt-0.5">Все модули включены · срок от 1 до 12 месяцев · оплата за срок вперёд</div>
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
