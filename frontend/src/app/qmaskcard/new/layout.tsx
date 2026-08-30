import type { Metadata } from "next";

/* Метаданные для клиентской страницы: сама она объявляет "use client" и
 * экспортировать metadata не может — Next это запрещает.
 *
 * СВОЙ canonical обязателен: без него страница наследует его из макета
 * раздела и просит поисковик показывать вместо себя раздел целиком.
 * Замер живого прода 30.08.2026: так вели себя 78 страниц сайта. */
export const metadata: Metadata = {
  title: "AEVION QMaskCard — выпустить карту",
  description:
    "Одноразовая карта для оплаты в интернете: лимит, срок и данные, которые не связаны с основной картой.",
  alternates: { canonical: "/qmaskcard/new" },
  openGraph: {
    title: "AEVION QMaskCard — выпустить карту",
    description:
      "Одноразовая карта для оплаты в интернете: лимит, срок и данные, которые не связаны с основной картой.",
    type: "website",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION QMaskCard — выпустить карту",
    description:
      "Одноразовая карта для оплаты в интернете: лимит, срок и данные, которые не связаны с основной картой.",
  },
};

export default function QMaskCardNewLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
