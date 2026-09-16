// Language metadata and helpers — small, and safe for any page to import.
//
// The translated strings do NOT live here any more. Until 10.08.2026 this file
// also held all eleven dictionaries in one object, and the client provider
// imports it, so every page of the platform downloaded every language: 1.3 MB
// of the 2.5 MB a page must load before it can answer a tap, measured with
// scripts/page-weight.mjs. They now live one language per file in i18n-lang/;
// the client takes `en` for the first render and fetches the visitor's language
// on demand (i18n.tsx), the server takes all of them at once (i18n-all.ts).
//
// This file stays separate from i18n.tsx because that file uses "use client",
// which makes non-component exports become opaque "client reference" stubs when
// imported from a server component — that failure looked like "Cannot read
// properties of undefined (reading <key>)" inside tServer().

export type Lang = "en" | "ru" | "kk" | "de" | "fr" | "es" | "zh" | "ja" | "ar" | "pt" | "tr";

export const LANGS: Lang[] = ["ru", "en", "kk", "de", "fr", "es", "zh", "ja", "ar", "pt", "tr"];

export const LANG_FLAG: Record<Lang, string> = {
  en: "🇺🇸", ru: "🇷🇺", kk: "🇰🇿", de: "🇩🇪", fr: "🇫🇷",
  es: "🇪🇸", zh: "🇨🇳", ja: "🇯🇵", ar: "🇸🇦", pt: "🇧🇷", tr: "🇹🇷",
};

export const LANG_SHORT: Record<Lang, string> = {
  en: "EN", ru: "RU", kk: "KZ", de: "DE", fr: "FR",
  es: "ES", zh: "ZH", ja: "JA", ar: "AR", pt: "PT", tr: "TR",
};

export const LANG_FULL: Record<Lang, string> = {
  en: "English",
  ru: "Русский",
  kk: "Қазақша",
  de: "Deutsch",
  fr: "Français",
  es: "Español",
  zh: "中文",
  ja: "日本語",
  ar: "العربية",
  pt: "Português",
  tr: "Türkçe",
};

// RTL languages
export const LANG_RTL: Partial<Record<Lang, true>> = { ar: true };

export const LANG_COOKIE = "aevion_lang_v1";

/**
 * How many keys each language actually has, generated 10.08.2026 alongside
 * src/lib/i18n-lang/*.ts.
 *
 * The language switcher shows coverage, and it used to count the keys of the
 * live dictionary — which meant importing all eleven of them just to draw a
 * percentage. These numbers cost nothing and say the same thing. Regenerate
 * them with scripts/splitI18n.mjs when a language grows.
 */
/*
 * Числа поправлены вручную 31.08.2026 при сборке к 10.09 — и это отступление
 * от нормы, поэтому объясняю.
 *
 * Обычно их пишет scripts/splitI18n.mjs, читая модуль, который экспортирует
 * ВЕСЬ словарь. После разбиения такого модуля больше нет: здесь остались
 * только служебные данные. При сведении веток я переносил новые ключи в
 * i18n-lang/*.ts программно (32 ключа QSkyway, 2 платёжных, 2 честных
 * формулировки про сертификацию), и константа отстала от файлов.
 *
 * Числа взяты подсчётом УНИКАЛЬНЫХ ключей в самих файлах, а не прикидкой:
 * ru 7385, en 7385, kk 7344. По ним langCoverage.ts показывает человеку
 * полноту перевода — то есть отставшая константа занижала бы её молча.
 */
/*
 * Пересчитано 04.09.2026 подсчётом УНИКАЛЬНЫХ ключей в файлах: ru 7399,
 * en 7399, kk 7358. Расхождение с прежними числами было ЧЕТЫРЕ ключа в
 * каждом языке, из них один мой (`checkoutSuccess.subtitlePending`) — три
 * остальных накопились раньше и никто не узнал: полный набор фронта на этой
 * машине не гонялся несколько дней, а CI запускается лишь на четырёх ветках.
 */
export const LANG_KEY_COUNT: Record<Lang, number> = {
  // 06.09: +2 (chargedRevenueByChannel, errorGeneric — возвращены потерянные
  // при мерже ключи денежных веток; usdNote уже был на месте).
  // 08.09: +2 в каждом словаре — titleNoPayment / subtitleNoPayment для
  // страницы успеха: она утверждала «Оплата принята. Деньги получены» даже
  // без всякого признака платежа, и случаю «признака нет» понадобился свой
  // честный текст.
  // 08.09 (второй раз за день): +1 — reg.tip.label, подпись «источник
  // ограничения» в общем компоненте. Была зашита по-русски и звучала так на
  // английских страницах QSkyway.
  // 13.09: +3 в ru/en/kk — qcoreai.opex.funnel.mrr.account (второй потолок
  // воронки, посчитанный только по посетителям с учётной записью) и
  // pricing.home.tier.notSellable / notSellableCta (погашенная кнопка
  // тарифа объясняет себя вместо молчания). Числа взяты из падения
  // самого сторожа, не посчитаны на глаз.
  // 14.09: +10 в ru/en/kk — moduleChip.* (кнопка покупки на 38 страницах
  // модулей была зашита по-русски; сторож chipSpeaksVisitorLanguage).
  // 15.09: +1 в ru/en/kk — qskyway.city.singapore (четвёртый город).
  // 16.09: +1 в ru/en/kk — qskyway.city.amsterdam (пятый город).
  // 16.09 (вечер): +1 в ru/en/kk — qskyway.city.berlin (шестой город).
  ru: 7464,
  en: 7464,
  kk: 7423,
  de: 134,
  fr: 134,
  es: 134,
  zh: 134,
  ja: 134,
  ar: 134,
  pt: 134,
  tr: 134,
};

export function interpolate(s: string, vars?: Record<string, string | number>): string {
  if (!vars) return s;
  let r = s;
  for (const [k, v] of Object.entries(vars)) {
    r = r.split(`{${k}}`).join(String(v));
  }
  return r;
}
