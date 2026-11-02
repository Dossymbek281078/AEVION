import type { ReactNode } from "react";
import type { Metadata } from "next";
import { serverLang } from "@/lib/serverLang";
import { ServerLangProvider } from "@/lib/serverLangContext";
import { AEVION_TITLES, tabTitleLang } from "@/lib/tabTitles";

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://aevion.app";

// The previous description promised Smart-NDA on QContract, escrow through
// QPayNet and public investor reputation. None of the three exists, and the
// first thing a visitor does with a marketplace is check whether it does what
// its own page says. Describes what actually ships.
// 2.11.2026: язык гостя (lib/tabTitles.ts) — на /en вкладка и превью были русскими.
const DESC = {
  ru: "Три уровня заявок: только идея (доля за вложение в разработку), идея + MVP (доля за вложение в доработку), готовый продукт (выкуп целиком или доли). У каждой заявки — названные условия сделки, бесплатный разбор с рыночным диапазоном цены и SHA-256 отпечаток авторства.",
  en: "Three listing tiers: idea only (a stake for funding development), idea + MVP (a stake for funding the finish), finished product (a full or partial buyout). Every listing has named deal terms, a free analysis with a market price range and a SHA-256 authorship fingerprint.",
  kk: "Өтінімнің үш деңгейі: тек идея (әзірлеуге салым үшін үлес), идея + MVP (жетілдіруге салым үшін үлес), дайын өнім (толық немесе үлесін сатып алу). Әр өтініште аталған мәміле шарттары, нарықтық баға аймағы бар тегін талдау және SHA-256 авторлық таңбасы бар.",
} as const;
const TW_DESC = {
  ru: "Идея, MVP или работающий продукт — с ценой, долей и разбором.",
  en: "An idea, an MVP or a working product — with a price, a stake and an analysis.",
  kk: "Идея, MVP немесе жұмыс істейтін өнім — бағасымен, үлесімен және талдауымен.",
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const lang = tabTitleLang(await serverLang("ru"));
  const title = AEVION_TITLES.startupx[lang];
  return {
  title,
  description: DESC[lang],
  alternates: {
    canonical: `${SITE}/startup-exchange`,
    // Читалки ищут ленту здесь: без этой строки RSS существует, но его не находят.
    types: { "application/rss+xml": `${SITE}/api-backend/api/startupx/rss.xml` },
  },
  openGraph: {
    type: "website",
    url: `${SITE}/startup-exchange`,
    title,
    // Превью ссылки — по-русски у каждого модуля волны (pageMetadata.guard): обходчики соцсетей
    // приходят без куки языка, им и так отдаётся ru.
    description: "Идея, MVP или работающий продукт — с ценой, долей и бесплатным разбором, который сравнивает запрос с рынком.",
    siteName: "AEVION",
  },
  // 13.09.2026: без своего блока страница наследовала корневой twitter, и на X
  // карточка подписывалась «AEVION — Trust OS» вместо имени модуля. Картинка
  // при этом уже своя — расходились именно подписи. Корневой блок НЕ трогаем:
  // для страниц без собственного описания он верен.
  twitter: {
    card: "summary_large_image",
    title,
    description: TW_DESC[lang],
  },
  robots: { index: true, follow: true },
  };
}

// Язык первого кадра решает сервер (кука / Accept-Language, умолчание ru): иначе страница
// рисует английский SSR, пока I18nProvider не определил язык, и русский гость видит вспышку.
export const dynamic = "force-dynamic";

export default async function StartupXLayout({ children }: { children: ReactNode }) {
  const lang = await serverLang("ru");
  return <ServerLangProvider lang={lang}>{children}</ServerLangProvider>;
}
