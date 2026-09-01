import type { Metadata } from "next";

/* Заголовок предпросмотра для клиентской страницы.
 * Страница объявляет "use client" и поэтому не может экспортировать metadata
 * сама — Next это запрещает. Без этого файла ссылка, посланная в мессенджер,
 * приходила с общим заголовком сайта.
 * Замер 30.08.2026: таких страниц с картинкой предпросмотра, но без своего
 * заголовка, было семнадцать. */
export const metadata: Metadata = {
  title: "AEVION Payments — Status",
  description:
    "Live availability of payment surfaces: which ones are operational and which are degraded right now.",
  openGraph: {
    title: "AEVION Payments — Status",
    description:
      "Live availability of payment surfaces: which ones are operational and which are degraded right now.",
    type: "website",
    siteName: "AEVION",
  },
  // СВОЙ canonical обязателен, иначе страница наследует родительский из
  // payments/layout.tsx и говорит поисковику «я копия /payments». Проверено
  // на проде 30.08.2026: /payments/api отдавал canonical на /payments, то
  // есть тринадцать страниц раздела схлопывались в одну для поиска.
  alternates: { canonical: "/payments/status" },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Payments — Status",
    description:
      "Live availability of payment surfaces: which ones are operational and which are degraded right now.",
  },
};

export default function PaymentsStatusLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
