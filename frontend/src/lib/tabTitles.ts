import type { Lang } from "@/lib/i18n-data";

/**
 * Заголовок вкладки на языке гостя — для /auth, /pricing, /multichat-engine, /bureau, /qsign.
 *
 * Замер 2.11.2026 (прод 5c84234b1, русский гость): вкладки шли по-английски или
 * двуязычной склейкой («… · Цены и тарифы»). Главная уже решает title по языку
 * (homeMetadata.ts); эти четыре страницы делают то же: layout читает serverLang и
 * берёт строку отсюда. ru/en/kk, любой другой язык — en. Имя платформы стоит в самой
 * строке, поэтому layout кладёт её как `absolute` (корневой шаблон второй бренд не допишет).
 */
export type ТитулыЯзык = "ru" | "en" | "kk";
export type СтраницаТитула = "auth" | "pricing" | "multichat" | "bureau" | "qsign";

export const AEVION_TITLES: Record<СтраницаТитула, Record<ТитулыЯзык, string>> = {
  auth: {
    ru: "Вход в AEVION — один аккаунт для всей платформы доверия",
    en: "Sign in to AEVION — one identity for the whole Trust OS",
    kk: "AEVION-ға кіру — бүкіл сенім платформасына бір аккаунт",
  },
  pricing: {
    ru: "Цены AEVION — одна подписка на ИС, ИИ и финтех",
    en: "AEVION Pricing — one subscription for IP, AI and fintech",
    kk: "AEVION бағалары — зияткерлік меншік, ЖИ және финтехке бір жазылым",
  },
  multichat: {
    ru: "AEVION Мультичат — совет трёх ИИ-агентов",
    en: "AEVION Multichat — a council of three AI agents",
    kk: "AEVION Мультичат — үш ЖИ-агент кеңесі",
  },
  bureau: {
    ru: "AEVION Бюро — публичный реестр авторов",
    en: "AEVION Bureau — public registry of authors",
    kk: "AEVION Бюро — авторлардың жария тізілімі",
  },
  qsign: {
    ru: "AEVION QSign — подпись и проверка документов",
    en: "AEVION QSign — canonical-JSON signing and verification",
    kk: "AEVION QSign — құжаттарға қол қою және тексеру",
  },
};

export function tabTitleLang(lang: Lang | string): ТитулыЯзык {
  return lang === "ru" || lang === "kk" ? lang : "en";
}
