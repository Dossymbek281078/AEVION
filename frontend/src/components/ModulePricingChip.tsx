"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/apiBase";
import { track } from "@/lib/track";
import { PRICING_APP, PRICING_TERMS, keepChannel } from "@/lib/products";
import { channelNow } from "@/lib/channelNow";
import { useI18nOptional } from "@/lib/i18n";
import {
  PLANET_BASE_MONTHLY,
  TERM_TIERS,
  fromPricePerMonth,
  standaloneApp,
} from "@/lib/termPricing";

// Плашка цены и кнопка покупки на страницах модулей (~40 страниц).
//
// ⚠️ 15.09.2026 — НОВАЯ ЦЕНОВАЯ ПОЛИТИКА (слово основателя). Тариф — это СРОК
// доступа ко всей планете (1–12 месяцев, оплата вперёд), и любой платный тариф
// включает ВСЕ модули. Отдельно продаются только пять приложений.
//
//   одно из пяти приложений → «от $X/мес · <имя> отдельно · вся планета от $200/мес»,
//                             кнопка ведёт на /pricing?app=<slug>#apps;
//   любой другой модуль     → «Входит в подписку AEVION · от $200/мес»,
//                             кнопка ведёт на /pricing#tiers.
//
// Прежде плашка читала /api/pricing (лестница Lite/Medium/Full помесячно) и
// одним нажатием оформляла Lite + модуль. Этой лестницы больше нет, а прямой
// кассы на новую лестницу нет: товары ещё заводятся в магазине. Поэтому кнопка —
// ссылка к выбору срока, а цены — из @/lib/termPricing (копия лестницы бэкенда
// под сторожем termPricingMatchesBackend): запрос за ценами не нужен вовсе, и
// плашка больше не пропадает, когда /api/pricing не ответил.
//
// «от» — месяц на самом длинном сроке (12 месяцев): это самая низкая цена,
// которую можно назвать честно. Число руками не пишется.

interface Props {
  moduleId: string;
  /**
   * Оставлено для совместимости вызовов. Цены лестницы названы в долларах —
   * так же, как на странице цен и в кассе; пересчёт в другие валюты не делаем,
   * чтобы плашка не спорила с кассой.
   */
  currency?: "USD" | "EUR" | "KZT" | "RUB";
  /** Optional dark/light theme (defaults to light). */
  theme?: "light" | "dark";
  /** Hide the buy link (chip stays informational). Default false. */
  hideBuy?: boolean;
}

/** Платные тарифы: любой из них включает все модули (политика 15.09.2026). */
const PAID_PLANS = new Set<string>([...TERM_TIERS, "enterprise"]);

export default function ModulePricingChip({ moduleId, theme = "light", hideBuy = false }: Props) {
  // 14.09.2026: тексты чипа были зашиты по-русски на 38 страницах модулей —
  // посетитель, выбравший English, видел «Купить» и «/мес» ровно там, где
  // решается покупка. Optional, а не useI18n: вне I18nProvider (тесты, редкие
  // страницы) остаётся русский текст, а не падение всего чипа.
  const i18n = useI18nOptional();
  const tr = (key: string, ru: string, vars?: Record<string, string | number>): string =>
    i18n
      ? i18n.t(key, vars)
      : Object.entries(vars ?? {}).reduce((s, [k, v]) => s.split(`{${k}}`).join(String(v)), ru);

  // Метка канала — после отрисовки: на сервере адреса нет, и ссылка, собранная
  // при отрисовке, разошлась бы с разметкой.
  const [channel, setChannel] = useState<string | null>(null);
  useEffect(() => {
    setChannel(channelNow());
  }, []);

  /*
   * 🔴 НЕ ПРОДАЁМ ТО, ЧТО У ЧЕЛОВЕКА УЖЕ ЕСТЬ (01.09.2026, переосмыслено 15.09.2026).
   *
   * Любой платный тариф новой лестницы открывает все модули, поэтому подписчику
   * кнопка «Купить» не показывается вовсе — вместо неё «Уже включено» и путь в
   * кабинет. Тариф берётся из /api/me/entitlements (поле plan).
   *
   * Незнание трактуется в пользу покупки: гость, человек без входа и незнакомое
   * значение тарифа видят кнопку. Молчание сервера не закрывает кассу.
   * Карта доступа по модулям (modules[].entitled) кнопку НЕ прячет: у бесплатного
   * тарифа entitled бывает истинным просто потому, что стена выключена, а у
   * платного вопрос уже решён тарифом.
   */
  const [ownPlan, setOwnPlan] = useState<string | null>(null);

  useEffect(() => {
    let живо = true;
    fetch(apiUrl("/api/me/entitlements"), { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!живо) return;
        setOwnPlan(typeof d?.plan === "string" ? d.plan.toLowerCase() : null);
      })
      .catch(() => {});
    return () => {
      живо = false;
    };
  }, []);

  const незачемПокупать = ownPlan !== null && PAID_PLANS.has(ownPlan);

  const app = standaloneApp(moduleId);
  const planetFrom = `$${fromPricePerMonth(PLANET_BASE_MONTHLY)}`;
  const appFrom = app ? `$${fromPricePerMonth(app.baseMonthly)}` : null;
  const href = keepChannel(app ? PRICING_APP(app.slug) : PRICING_TERMS, channel);

  const palette =
    theme === "dark"
      ? { bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.12)", text: "#e2e8f0", muted: "#94a3b8", accent: "#34d399" }
      : { bg: "#f8fafc", border: "rgba(15,23,42,0.08)", text: "#0f172a", muted: "#64748b", accent: "#0d9488" };

  const perMonth = tr("moduleChip.perMonth", "/мес");

  function onBuy() {
    // Намерение, а не начало оплаты: оплата начнётся на /pricing, и там своё
    // checkout_start. Слать его и здесь значило бы считать покупку дважды.
    track({
      type: "cta_click",
      source: `module-chip/${moduleId}`,
      meta: { target: app ? "app" : "planet", ...(app ? { app: app.slug } : {}) },
    });
  }

  return (
    // flexWrap + maxWidth: чип стоит в шапке модуля рядом с логотипом, и без
    // переноса он не давал шапке сложиться на телефоне — страница ехала вбок.
    // Замер 27.08.2026 при экране 375: /lifebox чип 231px -> 203px, документ
    // 572 -> 375 (вместе с починкой баннера в UpgradeButton.tsx).
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
        href={href}
        style={{ display: "inline-flex", flexWrap: "wrap", maxWidth: "100%", alignItems: "center", gap: 8, color: palette.text, textDecoration: "none" }}
        title={tr("moduleChip.compareTitle", "Сроки и цены: 1, 3, 6, 9 или 12 месяцев, оплата за срок вперёд")}
      >
        {app && appFrom ? (
          <>
            <span>
              {tr("moduleChip.from", "от")} <strong style={{ fontWeight: 800 }}>{appFrom}</strong>
              {perMonth}
            </span>
            <span style={{ color: palette.muted }}>·</span>
            {/* Имя приложения — внутри словарной строки, но без машинного
                перевода: «CyberChess» не должен стать «Кибершахматами». */}
            <span translate="no" className="notranslate">
              {tr("moduleChip.appAlone", "{name} отдельно", { name: app.name })}
            </span>
            <span style={{ color: palette.muted }}>·</span>
            <span style={{ color: palette.accent, fontWeight: 700 }}>
              {tr("moduleChip.planetFrom", "вся планета от {price}/мес", { price: planetFrom })}
            </span>
          </>
        ) : (
          <>
            <span>
              {tr("moduleChip.includedInPlanet", "Входит в подписку AEVION")}
            </span>
            <span style={{ color: palette.muted }}>·</span>
            <span style={{ color: palette.accent, fontWeight: 700 }}>
              {tr("moduleChip.from", "от")} <strong style={{ fontWeight: 800 }}>{planetFrom}</strong>
              {perMonth}
            </span>
          </>
        )}
      </Link>
      {!hideBuy && незачемПокупать && (
        <Link
          href="/account"
          title={tr("moduleChip.alreadyOpenTitle", "Ваша подписка AEVION уже открывает все модули — покупать этот отдельно незачем")}
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
          {tr("moduleChip.alreadyIncluded", "Уже включено")}
        </Link>
      )}
      {!hideBuy && !незачемПокупать && (
        <Link
          href={href}
          onClick={onBuy}
          title={
            app && appFrom
              ? tr("moduleChip.buyTitle", "Выбрать срок и оплатить — от {price}/мес при оплате за 12 месяцев", { price: appFrom })
              : tr("moduleChip.buyTitle", "Выбрать срок и оплатить — от {price}/мес при оплате за 12 месяцев", { price: planetFrom })
          }
          style={{
            padding: "6px 14px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 800,
            whiteSpace: "nowrap",
            textDecoration: "none",
            color: "#fff",
            background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
          }}
        >
          {tr("moduleChip.buy", "Купить")}
        </Link>
      )}
    </span>
  );
}
