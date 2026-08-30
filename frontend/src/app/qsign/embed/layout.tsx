import type { Metadata } from "next";

/* Метаданные для клиентской страницы: сама она объявляет "use client" и
 * экспортировать metadata не может — Next это запрещает.
 *
 * СВОЙ canonical обязателен. Без него страница наследует его из макета
 * раздела и говорит поисковику «я копия раздела, показывай его вместо меня».
 * Замер живого прода 30.08.2026: так вели себя 78 страниц сайта, включая
 * ведущие к оплате. */
export const metadata: Metadata = {
  title: "AEVION QSign — встроить подпись",
  description:
    "Как встроить проверку подписи на свой сайт: готовый фрагмент, проверка без обращения к нам.",
  alternates: { canonical: "/qsign/embed" },
  openGraph: {
    title: "AEVION QSign — встроить подпись",
    description:
      "Как встроить проверку подписи на свой сайт: готовый фрагмент, проверка без обращения к нам.",
    type: "website",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION QSign — встроить подпись",
    description:
      "Как встроить проверку подписи на свой сайт: готовый фрагмент, проверка без обращения к нам.",
  },
};

export default function QSignEmbedLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
