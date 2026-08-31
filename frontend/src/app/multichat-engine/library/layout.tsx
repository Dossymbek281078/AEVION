import type { Metadata } from "next";

/* Метаданные для клиентской страницы: сама она объявляет "use client" и
 * экспортировать metadata не может — Next это запрещает.
 *
 * СВОЙ canonical обязателен: без него страница наследует его из макета
 * раздела и просит поисковик показывать вместо себя раздел целиком.
 * Замер живого прода 30.08.2026: так вели себя 78 страниц сайта. */
export const metadata: Metadata = {
  title: "AEVION Multichat — библиотека ответов",
  description:
    "Сохранённые ответы совета моделей: что спрашивали, что ответили и сколько это стоило.",
  alternates: { canonical: "/multichat-engine/library" },
  openGraph: {
    title: "AEVION Multichat — библиотека ответов",
    description:
      "Сохранённые ответы совета моделей: что спрашивали, что ответили и сколько это стоило.",
    type: "website",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Multichat — библиотека ответов",
    description:
      "Сохранённые ответы совета моделей: что спрашивали, что ответили и сколько это стоило.",
  },
};

export default function MultichatLibraryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
