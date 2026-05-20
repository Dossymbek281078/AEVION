import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Changelog тарифов AEVION — что менялось и когда",
  description:
    "Полный журнал изменений pricing AEVION: новые модули, тарифы, промо-коды, изменения в условиях. Реверс-хронологически с фильтром по типу.",
  openGraph: {
    title: "AEVION Pricing Changelog",
    description:
      "Что добавили / изменили / убрали в тарифах AEVION. Хронология с группировкой по месяцам и фильтром.",
    type: "website",
    url: "https://aevion.io/pricing/changelog",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Pricing Changelog",
    description: "Журнал изменений тарифов и модулей.",
  },
  alternates: {
    canonical: "/pricing/changelog",
  },
};

export default function PricingChangelogLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
