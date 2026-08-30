import type { Metadata } from "next";

/* Заголовок предпросмотра для клиентской страницы.
 * Страница объявляет "use client" и потому не может экспортировать metadata
 * сама — Next это запрещает. Без этого файла ссылка, посланная в мессенджер,
 * приходила с общим заголовком сайта.
 * Замер 30.08.2026: из 149 страниц с картинкой предпросмотра семнадцать не
 * имели своего заголовка. */
export const metadata: Metadata = {
  title: "AEVION Payments — Developer API",
  description:
    "REST and JSON with idempotency keys, an OpenAPI 3.1 spec and official SDKs for the AEVION payment layer.",
  openGraph: {
    title: "AEVION Payments — Developer API",
    description:
      "REST and JSON with idempotency keys, an OpenAPI 3.1 spec and official SDKs for the AEVION payment layer.",
    type: "website",
    siteName: "AEVION",
  },
  // СВОЙ canonical обязателен, иначе страница наследует родительский из
  // payments/layout.tsx и говорит поисковику «я копия /payments». Проверено
  // на проде 30.08.2026: /payments/api отдавал canonical на /payments, то
  // есть тринадцать страниц раздела схлопывались в одну для поиска.
  alternates: { canonical: "/payments/api" },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Payments — Developer API",
    description:
      "REST and JSON with idempotency keys, an OpenAPI 3.1 spec and official SDKs for the AEVION payment layer.",
  },
};

export default function PaymentsApiLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
