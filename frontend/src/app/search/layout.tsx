import type { ReactNode } from "react";
import type { Metadata } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://aevion.app";

export const metadata: Metadata = {
  title: "Поиск по AEVION — товары, курсы, новости, события, вакансии, права",
  description:
    "Один поиск по всей платформе AEVION: QStore, QLearn, QNews, QEvents, QJobs и реестр прав QRight. Вводите запрос — результаты со всех модулей сразу.",
  alternates: { canonical: `${SITE}/search` },
  openGraph: {
    type: "website",
    url: `${SITE}/search`,
    title: "Поиск по AEVION",
    description: "Один запрос — результаты из QStore, QLearn, QNews, QEvents, QJobs и QRight.",
    siteName: "AEVION",
  },
  robots: { index: true, follow: true },
};

export default function SearchLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
