import type { ReactNode } from "react";
import type { Metadata } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://aevion.app";

// The previous description promised Smart-NDA on QContract, escrow through
// QPayNet and public investor reputation. None of the three exists, and the
// first thing a visitor does with a marketplace is check whether it does what
// its own page says. Describes what actually ships.
export const metadata: Metadata = {
  title: "Биржа стартапов — идея, MVP или готовый продукт · AEVION",
  description:
    "Три уровня заявок: только идея (доля за вложение в разработку), идея + MVP (доля за вложение в доработку), готовый продукт (выкуп целиком или доли). У каждой заявки — названные условия сделки, бесплатный разбор с рыночным диапазоном цены и SHA-256 отпечаток авторства.",
  alternates: {
    canonical: `${SITE}/startup-exchange`,
    // Читалки ищут ленту здесь: без этой строки RSS существует, но его не находят.
    types: { "application/rss+xml": `${SITE}/api-backend/api/startupx/rss.xml` },
  },
  openGraph: {
    type: "website",
    url: `${SITE}/startup-exchange`,
    title: "Биржа стартапов — идея, MVP или готовый продукт",
    description:
      "Идея, MVP или работающий продукт — с ценой, долей и бесплатным разбором, который сравнивает запрос с рынком.",
    siteName: "AEVION",
  },
  robots: { index: true, follow: true },
};

export default function StartupXLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
