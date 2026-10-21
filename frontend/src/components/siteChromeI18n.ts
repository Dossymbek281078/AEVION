/**
 * Словарь общей шапки (SiteHeader) и подвала (SiteFooter) — ru/en/kk.
 *
 * 21.10.2026, окно «Приложения», задача оркестратора «kk-главная — 0 латинских
 * строк у гостя». Ярлыки шапки и подвала были английскими литералами: по-русски
 * их переписывал AutoTranslate посевным словарём, а на kk — сетевым переводом,
 * который их эхом возвращал. Замер прибором yazyk-glavnaya-porog.mjs на сборке
 * 5a207d78a, kk 1463×724: в кадре Bureau, Awards, Bank, Chess, Company, Terms…
 *
 * ru — ровно те подписи, что ставил посевной словарь (или ближайшие по смыслу,
 * где его записи не было): русский посетитель не должен заметить перемены.
 * kk — черновик, ждёт вычитки носителем (как и data/moduleNames.ts).
 *
 * Сюда же — переключатель ИИ в шапке (AiOfflineToggle): «AI: Cloud» был в остатке того же замера.
 *
 * Имена продуктов (QRight, QSign, CyberChess, GitHub) не переводятся — они в
 * разметке под translate="no".
 */

import { useI18nOptional } from "@/lib/i18n";

const EN = {
  tagline: "Trust · IP · Globus",
  menuAria: "Site sections",
  demo: "Demo",
  explore: "Explore",
  shop: "Shop",
  auth: "Auth",
  bureau: "Bureau",
  planet: "Planet",
  awards: "Awards",
  bank: "Bank",
  chess: "Chess",
  pricing: "Pricing",
  about: "Global trust infrastructure for digital content, intellectual property and creator economy.",
  city: "Astana, Kazakhstan",
  products: "Products",
  company: "Company",
  contact: "Contact",
  qrightLink: "QRight — IP Registry",
  qsignLink: "QSign — Signatures",
  ipBureau: "IP Bureau",
  planetCompliance: "Planet Compliance",
  aevionBank: "AEVION Bank",
  termsOfService: "Terms of Service",
  privacyPolicy: "Privacy Policy",
  helpCenter: "Help Center",
  rights: "All rights reserved.",
  terms: "Terms",
  privacy: "Privacy",
  help: "Help",
  aiCloud: "AI: Cloud",
  aiOnPrem: "AI: On-prem",
  aiTipCloud: "AI runs on the cloud free fleet. Click to switch every module to the local / on-prem fleet (offline, no network egress).",
  aiTipOnPrem: "AI runs on the local / on-prem fleet — no data leaves your infrastructure. Click for the cloud free fleet.",
} as const;

export type ChromeKey = keyof typeof EN;

const RU: Record<ChromeKey, string> = {
  tagline: "Доверие · IP · Глобус",
  menuAria: "Меню разделов",
  demo: "Демо",
  explore: "Обзор",
  shop: "Магазин",
  auth: "Авторизация",
  bureau: "Бюро",
  planet: "Планета",
  awards: "Награды",
  bank: "Банк",
  chess: "Шахматы",
  pricing: "Цены",
  about: "Глобальная инфраструктура доверия для цифрового контента, интеллектуальной собственности и экономики авторов.",
  city: "Астана, Казахстан",
  products: "Продукты",
  company: "Компания",
  contact: "Контакты",
  qrightLink: "QRight — реестр IP",
  qsignLink: "QSign — подписи",
  ipBureau: "Патентное бюро",
  planetCompliance: "Planet Compliance",
  aevionBank: "Банк AEVION",
  termsOfService: "Условия",
  privacyPolicy: "Конфиденциальность",
  helpCenter: "Центр помощи",
  rights: "Все права защищены.",
  terms: "Условия",
  privacy: "Конфиденциальность",
  help: "Помощь",
  aiCloud: "ИИ: облако",
  aiOnPrem: "ИИ: локально",
  aiTipCloud: "ИИ работает в облачном бесплатном парке. Нажмите, чтобы перевести все модули на локальный парк (офлайн, без выхода в сеть).",
  aiTipOnPrem: "ИИ работает на локальном парке — данные не покидают вашу инфраструктуру. Нажмите, чтобы вернуть облачный бесплатный парк.",
};

const KK: Record<ChromeKey, string> = {
  tagline: "Сенім · IP · Глобус",
  menuAria: "Бөлімдер мәзірі",
  demo: "Демо",
  explore: "Шолу",
  shop: "Дүкен",
  auth: "Кіру",
  bureau: "Бюро",
  planet: "Планета",
  awards: "Марапаттар",
  bank: "Банк",
  chess: "Шахмат",
  pricing: "Бағалар",
  about: "Цифрлық контентке, зияткерлік меншікке және авторлар экономикасына арналған жаһандық сенім инфрақұрылымы.",
  city: "Астана, Қазақстан",
  products: "Өнімдер",
  company: "Компания",
  contact: "Байланыс",
  qrightLink: "QRight — IP тізілімі",
  qsignLink: "QSign — қолтаңбалар",
  ipBureau: "Патенттік бюро",
  planetCompliance: "Planet сәйкестігі",
  aevionBank: "AEVION Банкі",
  termsOfService: "Қызмет көрсету шарттары",
  privacyPolicy: "Құпиялылық саясаты",
  helpCenter: "Көмек орталығы",
  rights: "Барлық құқықтар қорғалған.",
  terms: "Шарттар",
  privacy: "Құпиялылық",
  help: "Көмек",
  aiCloud: "ЖИ: бұлт",
  aiOnPrem: "ЖИ: жергілікті",
  aiTipCloud: "ЖИ бұлттағы тегін паркте жұмыс істейді. Барлық модульді жергілікті паркке ауыстыру үшін басыңыз (офлайн, желіге шықпайды).",
  aiTipOnPrem: "ЖИ жергілікті паркте жұмыс істейді — деректер инфрақұрылымыңыздан шықпайды. Бұлттағы тегін паркке қайту үшін басыңыз.",
};

export const CHROME_DICT: Record<"en" | "ru" | "kk", Record<ChromeKey, string>> = { en: EN, ru: RU, kk: KK };
export const CHROME_KEYS = Object.keys(EN) as ChromeKey[];

/**
 * Язык шапки и подвала. Словарь — только для ru/en/kk; на прочих языках (de, fr…)
 * `own` = false: ярлык идёт английским БЕЗ translate="no", и его по-прежнему
 * переводит живой переводчик (иначе немец получил бы английскую шапку навсегда).
 * Вне провайдера (тесты) — en.
 */
export function useChromeLang(): { t: (k: ChromeKey) => string; own: boolean } {
  const lang = useI18nOptional()?.lang ?? "en";
  const own = lang === "en" || lang === "ru" || lang === "kk";
  const dict = own ? CHROME_DICT[lang as "en" | "ru" | "kk"] : EN;
  return { t: (k) => dict[k], own };
}
