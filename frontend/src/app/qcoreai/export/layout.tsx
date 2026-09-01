import type { Metadata } from "next";

/*
 * Выгрузка своих данных: страница читает список сессий по токену входа.
 * Без входа поисковый робот видит пустую оболочку — показывать её в выдаче нечего.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default function QcoreExportLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
