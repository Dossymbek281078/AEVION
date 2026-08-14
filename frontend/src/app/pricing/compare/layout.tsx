import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Сравнение тарифов AEVION — все модули × 4 тарифа",
  description:
    "Полная матрица: что входит в Free, Pro, Business и Enterprise. Все все модули AEVION — IP, AI, финтех, потребительские продукты — со статусами LIVE / BETA / SOON и ценами add-on.",
  openGraph: {
    title: "Сравнение тарифов AEVION — полная матрица",
    description:
      "Все все модули × 4 тарифа в одной таблице. Что включено, что доступно как add-on, что только в Enterprise.",
    type: "website",
    url: "https://aevion.io/pricing/compare",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION — Полная матрица тарифов",
    description: "все модули × Free / Pro / Business / Enterprise. Полное сравнение.",
  },
  alternates: {
    canonical: "/pricing/compare",
  },
};

export default function PricingCompareLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
