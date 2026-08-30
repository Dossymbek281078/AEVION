import type { Metadata } from "next";

/* Заголовок предпросмотра для клиентской страницы.
 * Страница объявляет "use client" и потому не может экспортировать metadata
 * сама — Next это запрещает. Без этого файла ссылка, посланная в мессенджер,
 * приходила с общим заголовком сайта.
 * Замер 30.08.2026: из 149 страниц с картинкой предпросмотра семнадцать не
 * имели своего заголовка. */
export const metadata: Metadata = {
  title: "AEVION Payments — Disputes",
  description:
    "Open and track chargebacks against any paid link: evidence, deadlines and current state of every dispute.",
  openGraph: {
    title: "AEVION Payments — Disputes",
    description:
      "Open and track chargebacks against any paid link: evidence, deadlines and current state of every dispute.",
    type: "website",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Payments — Disputes",
    description:
      "Open and track chargebacks against any paid link: evidence, deadlines and current state of every dispute.",
  },
};

export default function PaymentsDisputesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
