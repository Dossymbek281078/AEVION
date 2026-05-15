import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Реферальная программа AEVION — 20% recurring lifetime",
  description:
    "Присоединяйтесь к affiliate-программе AEVION: 20% от каждой подписки приведённого клиента, lifetime, payouts через Stripe Connect от $50.",
  openGraph: {
    title: "AEVION Affiliate Program",
    description: "20% recurring lifetime · 60d cookie · payouts от $50 через Stripe Connect.",
    type: "website",
    url: "https://aevion.io/pricing/affiliate",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Affiliate Program",
    description: "20% lifetime · 60d cookie · Stripe Connect payouts.",
  },
  alternates: {
    canonical: "/pricing/affiliate",
  },
};

export default function PricingAffiliateLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
