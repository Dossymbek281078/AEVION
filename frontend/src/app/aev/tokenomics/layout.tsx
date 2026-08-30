import type { Metadata } from "next";

/* Метаданные для клиентской страницы: сама она объявляет "use client" и
 * экспортировать metadata не может — Next это запрещает.
 *
 * СВОЙ canonical обязателен: без него страница наследует его из макета
 * раздела и просит поисковик показывать вместо себя раздел целиком.
 * Замер живого прода 30.08.2026: так вели себя 78 страниц сайта. */
export const metadata: Metadata = {
  title: "AEVION AEV — устройство токена",
  description:
    "Как устроен AEV: выпуск, распределение и на что он расходуется внутри платформы.",
  alternates: { canonical: "/aev/tokenomics" },
  openGraph: {
    title: "AEVION AEV — устройство токена",
    description:
      "Как устроен AEV: выпуск, распределение и на что он расходуется внутри платформы.",
    type: "website",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION AEV — устройство токена",
    description:
      "Как устроен AEV: выпуск, распределение и на что он расходуется внутри платформы.",
  },
};

export default function AevTokenomicsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
