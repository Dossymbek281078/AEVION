import type { Metadata } from "next";

/* Метаданные для клиентской страницы: сама она объявляет "use client" и
 * экспортировать metadata не может — Next это запрещает.
 *
 * СВОЙ canonical обязателен: без него страница наследует его из макета
 * раздела и просит поисковик показывать вместо себя раздел целиком.
 * Замер живого прода 30.08.2026: так вели себя 78 страниц сайта. */
export const metadata: Metadata = {
  title: "AEVION QVenture — пакетная оценка",
  description:
    "Оценка нескольких компаний за один заход: загрузите список и получите сравнимые результаты.",
  alternates: { canonical: "/qventure/batch" },
  openGraph: {
    title: "AEVION QVenture — пакетная оценка",
    description:
      "Оценка нескольких компаний за один заход: загрузите список и получите сравнимые результаты.",
    type: "website",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION QVenture — пакетная оценка",
    description:
      "Оценка нескольких компаний за один заход: загрузите список и получите сравнимые результаты.",
  },
};

export default function QVentureBatchLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
