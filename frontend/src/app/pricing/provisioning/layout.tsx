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
  title: "AEVION — выдача доступов",
  description:
    "Как доступ к оплаченным модулям выдаётся и когда он появляется в кабинете.",
  alternates: { canonical: "/pricing/provisioning" },
  openGraph: {
    title: "AEVION — выдача доступов",
    description:
      "Как доступ к оплаченным модулям выдаётся и когда он появляется в кабинете.",
    type: "website",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION — выдача доступов",
    description:
      "Как доступ к оплаченным модулям выдаётся и когда он появляется в кабинете.",
  },
};

export default function PricingProvisioningLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
