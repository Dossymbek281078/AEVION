// Серверная половина первого кадра для страниц, говорящих словарём через t()
// (главная «/», /pricing). Пара к lib/serverFrameText.tsx; образец — app/auth/authServerStrings.ts.
//
// Модуль серверный: тянет i18n-all (все языки). Из клиентского кода («use client»)
// импортировать нельзя — сторож i18n-split.
import type { Lang } from "@/lib/i18n-data";
import { translations } from "@/lib/i18n-all";

export type НаборКлючей = { prefixes?: readonly string[]; keys?: readonly string[] };

/** Ключи словаря `lang` по префиксам и точным именам (чего нет — из en, как делает t()). */
export function строкиКадра(lang: Lang, набор: НаборКлючей): Record<string, string> {
  const en = translations.en;
  const свой = translations[lang] ?? en;
  const префиксы = набор.prefixes ?? [];
  const точные = new Set(набор.keys ?? []);
  const out: Record<string, string> = {};
  for (const k of Object.keys(en)) {
    if (точные.has(k) || префиксы.some((p) => k.startsWith(p))) out[k] = свой[k] ?? en[k];
  }
  return out;
}

/** Что нужно главной «/» до прихода словаря: home.*, подпись ссылки на цены, определение мультичата. */
export const КЛЮЧИ_ГЛАВНОЙ: НаборКлючей = {
  prefixes: ["home."],
  keys: ["constitution.nav.pricing", "glossary.multichat.def"],
};

/** /pricing: все pricing.home.* и формы слова «месяц» (pricing.term.month.*). */
export const КЛЮЧИ_ЦЕН: НаборКлючей = {
  prefixes: ["pricing.home.", "pricing.term."],
};
