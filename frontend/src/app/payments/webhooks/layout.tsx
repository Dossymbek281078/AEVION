import type { Metadata } from "next";

/* Заголовок предпросмотра для клиентской страницы.
 * Страница объявляет "use client" и потому не может экспортировать metadata
 * сама — Next это запрещает. Без этого файла ссылка, посланная в мессенджер,
 * приходила с общим заголовком сайта.
 * Замер 30.08.2026: из 149 страниц с картинкой предпросмотра семнадцать не
 * имели своего заголовка. */
export const metadata: Metadata = {
  title: "AEVION Payments — Webhooks",
  description:
    "Real-time event delivery for every payment lifecycle state, with retries and signature verification.",
  openGraph: {
    title: "AEVION Payments — Webhooks",
    description:
      "Real-time event delivery for every payment lifecycle state, with retries and signature verification.",
    type: "website",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Payments — Webhooks",
    description:
      "Real-time event delivery for every payment lifecycle state, with retries and signature verification.",
  },
};

export default function PaymentsWebhooksLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
