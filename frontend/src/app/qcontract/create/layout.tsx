import type { Metadata } from "next";

/* Метаданные для клиентской страницы: сама она объявляет "use client" и
 * экспортировать metadata не может — Next это запрещает.
 *
 * СВОЙ canonical обязателен. Без него страница наследует его из макета
 * раздела и говорит поисковику «я копия раздела, показывай его вместо меня».
 * Замер живого прода 30.08.2026: так вели себя 78 страниц сайта, включая
 * ведущие к оплате. */
export const metadata: Metadata = {
  title: "AEVION QContract — создать договор",
  description:
    "Создание договора с подписью и проверяемой историей изменений. Готовый документ за минуты.",
  alternates: { canonical: "/qcontract/create" },
  openGraph: {
    title: "AEVION QContract — создать договор",
    description:
      "Создание договора с подписью и проверяемой историей изменений. Готовый документ за минуты.",
    type: "website",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION QContract — создать договор",
    description:
      "Создание договора с подписью и проверяемой историей изменений. Готовый документ за минуты.",
  },
};

export default function QContractCreateLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
