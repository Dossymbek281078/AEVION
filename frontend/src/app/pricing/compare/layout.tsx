import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Сравнение тарифов AEVION — 37 модулей × 4 тарифа",
  description:
    "Полная матрица: что входит в Free, Pro, Business и Enterprise. Все 37 модулей AEVION — IP, AI, финтех, потребительские продукты — со статусами LIVE / BETA / SOON и ценами add-on.",
  openGraph: {
    title: "Сравнение тарифов AEVION — полная матрица",
    description:
      "Все 37 модулей × 4 тарифа в одной таблице. Что включено, что доступно как add-on, что только в Enterprise.",
    type: "website",
    url: "https://aevion.io/pricing/compare",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION — Полная матрица тарифов",
    description: "37 модулей × Free / Pro / Business / Enterprise. Полное сравнение.",
  },
  alternates: {
    canonical: "/pricing/compare",
  },
};

export default function PricingCompareLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
