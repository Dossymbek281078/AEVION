import type { Metadata } from "next";

/* Метаданные для клиентской страницы: сама она объявляет "use client" и
 * экспортировать metadata не может — Next это запрещает.
 *
 * СВОЙ canonical обязателен: без него страница наследует его из макета
 * раздела и просит поисковик показывать вместо себя раздел целиком.
 * Замер живого прода 30.08.2026: так вели себя 78 страниц сайта. */
export const metadata: Metadata = {
  title: "AEVION QChainGov — новое голосование",
  description:
    "Создать голосование с проверяемым подсчётом: кто участвовал, как считали и что нельзя переписать задним числом.",
  alternates: { canonical: "/qchaingov/new" },
  openGraph: {
    title: "AEVION QChainGov — новое голосование",
    description:
      "Создать голосование с проверяемым подсчётом: кто участвовал, как считали и что нельзя переписать задним числом.",
    type: "website",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION QChainGov — новое голосование",
    description:
      "Создать голосование с проверяемым подсчётом: кто участвовал, как считали и что нельзя переписать задним числом.",
  },
};

export default function QChainGovNewLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
