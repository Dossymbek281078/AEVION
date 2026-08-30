import type { Metadata } from "next";

/* Заголовок предпросмотра для клиентской страницы.
 * Страница объявляет "use client" и потому не может экспортировать metadata
 * сама — Next это запрещает. Без этого файла ссылка, посланная в мессенджер,
 * приходила с общим заголовком сайта.
 * Замер 30.08.2026: из 149 страниц с картинкой предпросмотра семнадцать не
 * имели своего заголовка. */
export const metadata: Metadata = {
  title: "AEVION Payments — Payment Methods",
  description:
    "One unified API surface across every rail: cards, wallets, bank transfers and local methods.",
  openGraph: {
    title: "AEVION Payments — Payment Methods",
    description:
      "One unified API surface across every rail: cards, wallets, bank transfers and local methods.",
    type: "website",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Payments — Payment Methods",
    description:
      "One unified API surface across every rail: cards, wallets, bank transfers and local methods.",
  },
};

export default function PaymentsMethodsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
