"use client";

import { KeepChannelLink } from "@/components/KeepChannelLink";
import { useI18nOptional } from "@/lib/i18n";

/*
 * 🔴 27.10.2026 (Приложения-2, решение оркестратора — вариант «б»): у тренажёра НЕТ платной части —
 * бэкенд его намеренно не закрывает (index.ts: «Deliberately NOT gated here: … smeta-trainer»), в
 * PAYWALL_MODULES прода его нет, поэтому крючок page.tsx (fetchOrPaywall → PaywallScreen) 402 не получает.
 * А плашка ModulePricingChip говорила «Входит в подписку AEVION · от $150/мес · Купить» и вела в кассу
 * плана, который в самом тренажёре ничего не открывает. Продавать то, что ничего не открывает, нельзя.
 * Здесь — честно: бесплатно, и ссылка на платные приложения AEVION (страница цен, не касса).
 * Платную часть (экзамен с разбором, импорт ЛСР с ИИ) основатель решит после первых оплат.
 */
const ТЕКСТ = {
  ru: { free: "Бесплатно · входит в AEVION", paid: "Платные приложения AEVION →" },
  en: { free: "Free · part of AEVION", paid: "Paid AEVION apps →" },
  kk: { free: "Тегін · AEVION құрамында", paid: "AEVION ақылы қосымшалары →" },
} as const;

export function FreeChip() {
  const lang = useI18nOptional()?.lang;
  const т = lang === "en" || lang === "kk" ? ТЕКСТ[lang] : lang && lang !== "ru" ? ТЕКСТ.en : ТЕКСТ.ru;
  return (
    <span className="inline-flex items-center gap-2 text-[11px]" data-testid="smeta-free-chip">
      <span className="text-emerald-300 font-semibold">{т.free}</span>
      <KeepChannelLink href="/pricing" className="text-slate-300 underline-offset-2 hover:underline hover:text-emerald-300">
        {т.paid}
      </KeepChannelLink>
    </span>
  );
}
