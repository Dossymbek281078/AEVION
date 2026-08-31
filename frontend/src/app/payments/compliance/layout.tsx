import type { Metadata } from "next";

/* Заголовок предпросмотра для клиентской страницы.
 * Страница объявляет "use client" и поэтому не может экспортировать metadata
 * сама — Next это запрещает. Без этого файла ссылка, посланная в мессенджер,
 * приходила с общим заголовком сайта.
 * Замер 30.08.2026: таких страниц с картинкой предпросмотра, но без своего
 * заголовка, было семнадцать. */
export const metadata: Metadata = {
  title: "AEVION Payments — Compliance",
  description:
    "How payment flows meet regulatory requirements: checks, records and what an auditor can verify independently.",
  openGraph: {
    title: "AEVION Payments — Compliance",
    description:
      "How payment flows meet regulatory requirements: checks, records and what an auditor can verify independently.",
    type: "website",
    siteName: "AEVION",
  },
  // СВОЙ canonical обязателен, иначе страница наследует родительский из
  // payments/layout.tsx и говорит поисковику «я копия /payments». Проверено
  // на проде 30.08.2026: /payments/api отдавал canonical на /payments, то
  // есть тринадцать страниц раздела схлопывались в одну для поиска.
  alternates: { canonical: "/payments/compliance" },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Payments — Compliance",
    description:
      "How payment flows meet regulatory requirements: checks, records and what an auditor can verify independently.",
  },
};

export default function PaymentsComplianceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
