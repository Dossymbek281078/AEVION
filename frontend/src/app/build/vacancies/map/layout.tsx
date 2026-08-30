import type { Metadata } from "next";

/* Метаданные для клиентской страницы: сама она объявляет "use client" и
 * экспортировать metadata не может — Next это запрещает.
 *
 * СВОЙ canonical обязателен: без него страница наследует его из макета
 * раздела и просит поисковик показывать вместо себя раздел целиком.
 * Замер живого прода 30.08.2026: так вели себя 78 страниц сайта. */
export const metadata: Metadata = {
  title: "AEVION Build — карта вакансий",
  description:
    "Открытые вакансии на карте: где ищут разработчиков и какие навыки нужны в каждом месте.",
  alternates: { canonical: "/build/vacancies/map" },
  openGraph: {
    title: "AEVION Build — карта вакансий",
    description:
      "Открытые вакансии на карте: где ищут разработчиков и какие навыки нужны в каждом месте.",
    type: "website",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Build — карта вакансий",
    description:
      "Открытые вакансии на карте: где ищут разработчиков и какие навыки нужны в каждом месте.",
  },
};

export default function BuildVacanciesMapLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
