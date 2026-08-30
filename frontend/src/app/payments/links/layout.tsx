import type { Metadata } from "next";

/* Заголовок предпросмотра для клиентской страницы.
 * Страница объявляет "use client" и потому не может экспортировать metadata
 * сама — Next это запрещает. Без этого файла ссылка, посланная в мессенджер,
 * приходила с общим заголовком сайта.
 * Замер 30.08.2026: из 149 страниц с картинкой предпросмотра семнадцать не
 * имели своего заголовка. */
export const metadata: Metadata = {
  title: "AEVION Payments — Payment Links",
  description:
    "Generate a shareable payment link in seconds and send it by email, chat or QR. No integration required.",
  openGraph: {
    title: "AEVION Payments — Payment Links",
    description:
      "Generate a shareable payment link in seconds and send it by email, chat or QR. No integration required.",
    type: "website",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Payments — Payment Links",
    description:
      "Generate a shareable payment link in seconds and send it by email, chat or QR. No integration required.",
  },
};

export default function PaymentsLinksLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
