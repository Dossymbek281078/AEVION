import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Политика возвратов AEVION — Refund Policy",
  description:
    "14-дневный возврат для платных тарифов, прорейтинг при даунгрейде, экспорт данных в любой момент. Чёткие условия — без юридического жаргона.",
  openGraph: {
    title: "AEVION — Политика возвратов",
    description:
      "14 дней money-back, прорейтинг даунгрейдов, экспорт данных, retain-период 90 дней.",
    type: "website",
    url: "https://aevion.io/pricing/refund-policy",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Refund Policy",
    description: "14-day money back · prorated · data export anytime.",
  },
  alternates: {
    canonical: "/pricing/refund-policy",
  },
};

export default function PricingRefundLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
