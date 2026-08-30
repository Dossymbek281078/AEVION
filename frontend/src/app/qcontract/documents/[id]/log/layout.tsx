import type { Metadata } from "next";

/*
 * Журнал действий по документу: страница прямо отвечает «нужен вход», если токена нет.
 * Приходят сюда со страницы самого документа, нажав кнопку, а не из поиска.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default function QcontractDocumentLogLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
