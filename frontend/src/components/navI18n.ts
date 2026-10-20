/**
 * Словарь общей навигации первой волны (Wave1Nav, 126 страниц) и степпера
 * IP-конвейера (PipelineSteps) — ru/en/kk.
 *
 * 20.10.2026, окно «Приложения» (развилка 1 по слову оркестратора). До этого ярлыки
 * были английскими литералами, а по-русски их показывал машинный доводчик
 * AutoTranslate по посевному словарю (DOM-перезапись после монтирования); на kk —
 * сетевой перевод, который на страницах из APP_PREFIXES (/qsign, /qright…) не
 * работает вовсе: замер 20.10 — 4–25 английских слов в кадре при kk. Словарь
 * делает ярлыки детерминированными на всех трёх языках и без сети.
 *
 * Имена продуктов (QRight, QSign, QCoreAI, DevHub, QTrade…) не переводятся — это
 * значения, не подписи; они не входят в словарь и остаются в разметке.
 */

import { useI18nOptional } from "@/lib/i18n";

const EN = {
  globus: "← Globus",
  demo: "Demo",
  deepDive: "Deep dive",
  pitch: "Pitch · Partnership",
  auth: "Auth",
  qright: "QRight",
  qsign: "QSign",
  shield: "Shield",
  bureau: "Bureau",
  musicAwards: "Music Awards",
  filmAwards: "Film Awards",
  bank: "Bank",
  chess: "Chess",
  startupExchange: "Startup Exchange",
  studio: "Studio",
  smeta: "Smeta Trainer",
  revenue: "Revenue",
  sdks: "SDKs",
  planet: "Planet",
  ariaNav: "Wave 1 navigation",
  ariaPipeline: "IP pipeline steps",
  aevWallet: "AEV wallet",
} as const;

export type NavKey = keyof typeof EN;

const RU: Record<NavKey, string> = {
  globus: "← Глобус",
  demo: "Демо",
  deepDive: "Глубокое погружение",
  pitch: "Питч · Партнёрство",
  auth: "Авторизация",
  qright: "QRight",
  qsign: "QSign",
  shield: "Щит",
  bureau: "Бюро",
  musicAwards: "Музыкальные премии",
  filmAwards: "Кинопремии",
  bank: "Банк",
  chess: "Шахматы",
  startupExchange: "Биржа стартапов",
  studio: "Студия",
  smeta: "Смета",
  revenue: "Доход",
  sdks: "SDK",
  planet: "Планета",
  ariaNav: "Навигация первой волны",
  ariaPipeline: "Шаги IP-конвейера",
  aevWallet: "AEV кошелёк",
};

const KK: Record<NavKey, string> = {
  globus: "← Глобус",
  demo: "Демо",
  deepDive: "Терең шолу",
  pitch: "Питч · Серіктестік",
  auth: "Кіру",
  qright: "QRight",
  qsign: "QSign",
  shield: "Қалқан",
  bureau: "Бюро",
  musicAwards: "Музыка сыйлықтары",
  filmAwards: "Кино сыйлықтары",
  bank: "Банк",
  chess: "Шахмат",
  startupExchange: "Стартап биржасы",
  studio: "Студия",
  smeta: "Смета",
  revenue: "Кіріс",
  sdks: "SDK",
  planet: "Планета",
  ariaNav: "Бірінші толқын навигациясы",
  ariaPipeline: "IP конвейерінің қадамдары",
  aevWallet: "AEV әмияны",
};

export const NAV_DICT: Partial<Record<string, Record<NavKey, string>>> = { en: EN, ru: RU, kk: KK };
export const NAV_KEYS = Object.keys(EN) as NavKey[];

/** Ярлык по ключу; неизвестный язык → английский (как и остальная платформа). */
export function tNav(lang: string | undefined, key: NavKey): string {
  return (lang && NAV_DICT[lang]?.[key]) ?? EN[key];
}

/**
 * Язык для навигации: провайдер, а вне его — "ru" (так было до словаря: русские
 * ярлыки «Биржа стартапов»/«Смета» рисовались по умолчанию). Optional, не useI18n:
 * компонент стоит и в тестах без провайдера.
 */
export function useNavLang(): string {
  return useI18nOptional()?.lang ?? "ru";
}
