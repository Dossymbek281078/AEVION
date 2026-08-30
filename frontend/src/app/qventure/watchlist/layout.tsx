import type { Metadata } from "next";

/* Метаданные для клиентской страницы: сама она объявляет "use client" и
 * экспортировать metadata не может — Next это запрещает.
 *
 * СВОЙ canonical обязателен: без него страница наследует его из макета
 * раздела и просит поисковик показывать вместо себя раздел целиком.
 * Замер живого прода 30.08.2026: так вели себя 78 страниц сайта. */
export const metadata: Metadata = {
  title: "AEVION QVenture — список наблюдения",
  description:
    "Компании, за которыми вы следите: изменения оценки, раунды и сигналы в одном списке.",
  alternates: { canonical: "/qventure/watchlist" },
  openGraph: {
    title: "AEVION QVenture — список наблюдения",
    description:
      "Компании, за которыми вы следите: изменения оценки, раунды и сигналы в одном списке.",
    type: "website",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION QVenture — список наблюдения",
    description:
      "Компании, за которыми вы следите: изменения оценки, раунды и сигналы в одном списке.",
  },
};

export default function QVentureWatchlistLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
