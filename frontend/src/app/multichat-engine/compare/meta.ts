// 1.11.2026 (от Продаж): заголовок нёс «ChatGPT», которого в совете нет — назван совет как есть,
// в линии карточки Мультичата (8c45c2ce8): Claude, Gemini и открытая модель. ChatGPT остаётся только в FAQ «есть ли?» — «нет».
// Мета трёх языковых адресов страницы сравнения: canonical на себя, hreflang на все три (как у /cyberchess/traps).
import type { Metadata } from "next";
import type { Yazyk } from "./compareText";

const SITE = "https://aevion.app";
export const COMPARE_PATHS: Record<Yazyk, string> = {
  ru: "/multichat-engine/compare",
  en: "/en/multichat-engine/compare",
  kk: "/kk/multichat-engine/compare",
};

const TEXT: Record<Yazyk, { title: string; description: string; locale: string }> = {
  ru: {
    title: "Claude, Gemini и открытая модель: как спросить несколько нейросетей сразу | Мультичат",
    description:
      "Задайте один вопрос совету из трёх ИИ-агентов и сразу увидите, где их ответы расходятся: противоречия, разные числа, что проверить. 2 вопроса в день бесплатно.",
    locale: "ru_RU",
  },
  en: {
    title: "Claude, Gemini and an open model: ask several AIs at once and compare | Multichat",
    description:
      "Ask one question to a council of three AI agents and see where their answers disagree: contradictions, different numbers, what to check. 2 free questions a day.",
    locale: "en_US",
  },
  kk: {
    title: "Claude, Gemini және ашық модель: бірнеше нейрожеліден бірден сұрау | Мультичат",
    description:
      "Бір сұрақты үш ЖИ-агенттен тұратын кеңеске қойып, жауаптардың қай жерде алшақтайтынын бірден көріңіз: қайшылықтар, әртүрлі сандар, не тексеру керек. Күніне 2 тегін сұрақ.",
    locale: "kk_KZ",
  },
};

export const compareUrl = (lang: Yazyk): string => SITE + COMPARE_PATHS[lang];
export const COMPARE_LANGUAGES: Record<string, string> = {
  ru: SITE + COMPARE_PATHS.ru,
  en: SITE + COMPARE_PATHS.en,
  kk: SITE + COMPARE_PATHS.kk,
  "x-default": SITE + COMPARE_PATHS.en,
};

export function compareMetadata(lang: Yazyk): Metadata {
  const t = TEXT[lang];
  const url = compareUrl(lang);
  return {
    title: t.title,
    description: t.description,
    alternates: { canonical: url, languages: COMPARE_LANGUAGES },
    openGraph: { title: t.title, description: t.description, url, type: "article", locale: t.locale, siteName: "AEVION Multichat" },
    twitter: { card: "summary", title: t.title, description: t.description },
  };
}
