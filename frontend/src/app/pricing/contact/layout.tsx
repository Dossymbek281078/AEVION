import type { Metadata } from "next";

/* Метаданные для клиентской страницы: сама она объявляет "use client" и
 * экспортировать metadata не может — Next это запрещает.
 *
 * СВОЙ canonical здесь обязателен. Без него страница наследует его из
 * pricing/layout.tsx и говорит поисковику «я копия /pricing, показывай
 * раздел вместо меня». Проверено на живом проде 30.08.2026: так вели себя
 * 78 страниц сайта, включая те, что ведут к оплате.
 *
 * Заголовок написан по смыслу адреса: текст самой страницы собирается из
 * файлов перевода во время работы, а метаданные нужны серверу заранее. */
export const metadata: Metadata = {
  title: "AEVION — связаться о тарифах",
  description:
    "Вопрос по тарифам, объёму или корпоративному пакету: напишите нам, ответим по существу.",
  alternates: { canonical: "/pricing/contact" },
  openGraph: {
    title: "AEVION — связаться о тарифах",
    description:
      "Вопрос по тарифам, объёму или корпоративному пакету: напишите нам, ответим по существу.",
    type: "website",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION — связаться о тарифах",
    description:
      "Вопрос по тарифам, объёму или корпоративному пакету: напишите нам, ответим по существу.",
  },
};

export default function PricingContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
