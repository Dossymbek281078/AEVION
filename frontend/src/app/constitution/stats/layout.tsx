import type { Metadata } from "next";
import type { ReactNode } from "react";

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://aevion.app";

export const metadata: Metadata = {
  title: "Constitution Analytics — distribution + trends · AEVION",
  description:
    "Аналитика опубликованных конституций: распределение по 10 режимам, гистограммы 8 ползунков, 30-дневный тренд публикаций. Какие политические системы строят люди прямо сейчас.",
  alternates: { canonical: `${SITE}/constitution/stats` },
  openGraph: {
    title: "Constitution Analytics — distribution + trends",
    description: "Live аналитика политических сценариев экосистемы AEVION.",
    url: `${SITE}/constitution/stats`,
    type: "website",
  },
};

export default function StatsLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
