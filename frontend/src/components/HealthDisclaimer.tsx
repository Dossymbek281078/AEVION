"use client";

// Shared health/wellness disclaimer banner for health-adjacent modules
// (QMelanin, QRenew, HealthAI...). Not medical advice.
// 24.10.2026: на /en и /kk оговорка шла по-русски — теперь по языку сайта.
import type { CSSProperties } from "react";
import { useI18nOptional } from "@/lib/i18n";

const box: CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "flex-start",
  margin: "14px 0 22px",
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid rgba(180,120,20,0.35)",
  background: "rgba(230,178,74,0.08)",
  fontSize: 13,
  lineHeight: 1.5,
  color: "inherit",
};
const mark: CSSProperties = { fontSize: 15, lineHeight: 1.3, flex: "0 0 auto" };
const strong: CSSProperties = { fontWeight: 700 };

// ⚠️ kk — черновой перевод, нужна вычитка носителя
const ТЕКСТ = {
  ru: {
    label: "Медицинский дисклеймер",
    head: "Образовательный материал, а не медицинская помощь.",
    body: "Не является диагнозом, назначением или заменой консультации врача. Любые протоколы, добавки и дозы — только по согласованию с вашим лечащим врачом. Результат не гарантирован.",
  },
  en: {
    label: "Medical disclaimer",
    head: "Educational material, not medical care.",
    body: "This is not a diagnosis, a prescription or a substitute for seeing a doctor. Any protocols, supplements and doses — only as agreed with your own doctor. Results are not guaranteed.",
  },
  kk: {
    label: "Медициналық ескерту",
    head: "Бұл медициналық көмек емес, білім беру материалы.",
    body: "Бұл диагноз, тағайындау немесе дәрігер кеңесінің орнын басатын нәрсе емес. Кез келген хаттамалар, қоспалар мен мөлшерлер — тек емдеуші дәрігеріңізбен келісіп. Нәтижеге кепілдік берілмейді.",
  },
} as const;

export function HealthDisclaimer() {
  const i18n = useI18nOptional();
  const t = ТЕКСТ[i18n?.lang === "en" ? "en" : i18n?.lang === "kk" ? "kk" : "ru"];
  return (
    <div style={box} role="note" aria-label={t.label}>
      <span style={mark} aria-hidden="true">⚕</span>
      <span>
        <span style={strong}>{t.head}</span>{" "}
        {t.body}
      </span>
    </div>
  );
}

export default HealthDisclaimer;
