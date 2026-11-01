// Мета трёх языковых адресов страницы ловушек: canonical на себя, hreflang на все три.
import type { Metadata } from "next";
import type { Yazyk } from "./traps";

const SITE = "https://aevion.app";
export const TRAPS_PATHS: Record<Yazyk, string> = {
  ru: "/cyberchess/traps",
  en: "/en/cyberchess/traps",
  kk: "/kk/cyberchess/traps",
};

const TEXT: Record<Yazyk, { title: string; description: string; locale: string }> = {
  ru: {
    title: "10 шахматных ловушек в дебюте — на интерактивной доске | CyberChess",
    description:
      "Мат Легаля, детский мат, ловушка Блэкберна–Шиллинга, слоновая, сибирская и ещё 5 ловушек: листайте ходы на доске, узнайте ошибку и сыграйте с ИИ-тренером.",
    locale: "ru_RU",
  },
  en: {
    title: "10 chess opening traps on an interactive board | CyberChess",
    description:
      "Légal's Mate, Scholar's Mate, the Blackburne Shilling, Elephant and Siberian traps and 5 more: step through the moves, spot the mistake, then play the AI coach.",
    locale: "en_US",
  },
  kk: {
    title: "Дебюттегі 10 шахмат тұзағы — интерактивті тақтада | CyberChess",
    description:
      "Легаль маты, балалар маты, Блэкберн–Шиллинг, піл және сібір тұзақтары және тағы 5 тұзақ: тақтада жүрістерді парақтап, қатені табыңыз да, ЖИ-жаттықтырушымен ойнаңыз.",
    locale: "kk_KZ",
  },
};

export const trapsUrl = (lang: Yazyk): string => SITE + TRAPS_PATHS[lang];
export const TRAPS_LANGUAGES: Record<string, string> = {
  ru: SITE + TRAPS_PATHS.ru,
  en: SITE + TRAPS_PATHS.en,
  kk: SITE + TRAPS_PATHS.kk,
  "x-default": SITE + TRAPS_PATHS.en,
};

export function trapsMetadata(lang: Yazyk): Metadata {
  const t = TEXT[lang];
  const url = trapsUrl(lang);
  return {
    title: t.title,
    description: t.description,
    alternates: { canonical: url, languages: TRAPS_LANGUAGES },
    openGraph: { title: t.title, description: t.description, url, type: "article", locale: t.locale, siteName: "AEVION CyberChess" },
    twitter: { card: "summary", title: t.title, description: t.description },
  };
}
