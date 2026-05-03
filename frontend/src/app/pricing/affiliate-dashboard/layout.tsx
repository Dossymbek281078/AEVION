import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Affiliate Dashboard — AEVION",
  description:
    "Личный кабинет affiliate-партнёра AEVION: ваш реферальный код, статистика кликов, MRR и payouts. Вход по magic-link, отправляемому на email.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "AEVION Affiliate Dashboard",
    description: "Реферальная статистика, payouts, ссылки.",
    type: "website",
    url: "https://aevion.io/pricing/affiliate-dashboard",
    siteName: "AEVION",
  },
  alternates: {
    canonical: "/pricing/affiliate-dashboard",
  },
};

export default function AffiliateDashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
