import type { Metadata } from "next";

/* Метаданные для клиентской страницы: сама она объявляет "use client" и
 * экспортировать metadata не может — Next это запрещает.
 *
 * СВОЙ canonical обязателен: без него страница наследует его из макета
 * раздела и просит поисковик показывать вместо себя раздел целиком.
 * Замер живого прода 30.08.2026: так вели себя 78 страниц сайта. */
export const metadata: Metadata = {
  title: "AEVION Бюро — организация",
  description:
    "Профиль организации в бюро: сертификаты, нотариусы и подтверждённые документы в одном месте.",
  alternates: { canonical: "/bureau/org" },
  openGraph: {
    title: "AEVION Бюро — организация",
    description:
      "Профиль организации в бюро: сертификаты, нотариусы и подтверждённые документы в одном месте.",
    type: "website",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Бюро — организация",
    description:
      "Профиль организации в бюро: сертификаты, нотариусы и подтверждённые документы в одном месте.",
  },
};

export default function BureauOrgLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
