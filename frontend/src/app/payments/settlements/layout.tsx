import type { Metadata } from "next";

/* Заголовок предпросмотра для клиентской страницы.
 * Страница объявляет "use client" и поэтому не может экспортировать metadata
 * сама — Next это запрещает. Без этого файла ссылка, посланная в мессенджер,
 * приходила с общим заголовком сайта.
 * Замер 30.08.2026: таких страниц с картинкой предпросмотра, но без своего
 * заголовка, было семнадцать. */
export const metadata: Metadata = {
  title: "AEVION Payments — Settlements",
  description:
    "Settlement schedule, amounts and status for money moving out of the AEVION payment layer.",
  openGraph: {
    title: "AEVION Payments — Settlements",
    description:
      "Settlement schedule, amounts and status for money moving out of the AEVION payment layer.",
    type: "website",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Payments — Settlements",
    description:
      "Settlement schedule, amounts and status for money moving out of the AEVION payment layer.",
  },
};

export default function PaymentsSettlementsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
