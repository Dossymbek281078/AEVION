"use client";

/**
 * Плашка «Создано с ИИ» — ОДИН компонент на весь сайт (слово основателя 28.10.2026,
 * через Оркестратора: «делай плашку»). Ставится в каждом месте, где человеку
 * показывают текст, который написала модель: чаты QCoreAI/QAI, советник банка,
 * тренер CyberChess, совет Мультичата, поддержка PsyApp, «Спроси ИИ» детям,
 * разбор тренажёра смет и т. д. Перечень мест держит сторож
 * `src/app/__tests__/iiOtvetSPlashkoy.guard.test.ts` — новое место без плашки
 * краснеет.
 *
 * Язык — из общего механизма (`useI18nOptional`), как у HealthDisclaimer: без
 * провайдера (тесты) — русский. Словарь свой, без `t("…")`: первый `t("` в файле
 * будит сторож attrI18n на всех его старых строках (урок 21.10).
 *
 * Вид не зависит от темы: цвет наследуется, фон и рамка полупрозрачные — одна и
 * та же плашка читается и на белом чате QCoreAI, и на тёмной панели ИИ-коуча.
 *
 * ⚠️ kk — черновой перевод, нужна вычитка носителя.
 */
import type { CSSProperties } from "react";
import { useI18nOptional } from "@/lib/i18n";

export const AI_BADGE_TEXT = {
  ru: { label: "Создано с ИИ", hint: "Этот ответ написала модель ИИ. Она может ошибаться — проверяйте важное." },
  en: { label: "Created with AI", hint: "This answer was written by an AI model. It can be wrong — double-check what matters." },
  kk: { label: "ЖИ арқылы жасалды", hint: "Бұл жауапты ЖИ моделі жазды. Ол қателесуі мүмкін — маңыздысын тексеріңіз." },
} as const;

export type AiBadgeLang = keyof typeof AI_BADGE_TEXT;

const base: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  margin: "0 0 8px",
  padding: "2px 8px",
  borderRadius: 999,
  border: "1px solid rgba(127,127,127,0.35)",
  background: "rgba(127,127,127,0.12)",
  color: "inherit",
  opacity: 0.85,
  fontSize: 11,
  lineHeight: 1.4,
  fontWeight: 700,
  letterSpacing: 0.2,
  whiteSpace: "nowrap",
  verticalAlign: "middle",
  cursor: "help",
};

export function aiBadgeLang(lang: string | undefined | null): AiBadgeLang {
  return lang === "en" ? "en" : lang === "kk" ? "kk" : "ru";
}

export function AiBadge({ lang, style }: { lang?: AiBadgeLang; style?: CSSProperties }) {
  const i18n = useI18nOptional();
  const t = AI_BADGE_TEXT[lang ?? aiBadgeLang(i18n?.lang)];
  return (
    <span data-ai-badge="1" role="note" aria-label={t.hint} title={t.hint} style={{ ...base, ...style }}>
      <span aria-hidden="true">✦</span>
      {t.label}
    </span>
  );
}

export default AiBadge;
