import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Сравнение тарифов AEVION — 43 модуля × 6 тарифов",
  description:
    "Полная матрица: что входит в Free, Lite, Medium, Full, Universe и Enterprise. Все 43 модуля AEVION — IP, AI, финтех, потребительские продукты — со статусами LIVE / BETA / SOON и ценами add-on.",
  openGraph: {
    title: "Сравнение тарифов AEVION — полная матрица",
    description:
      "Все 43 модуля × 6 тарифов в одной таблице. Что включено, что доступно как add-on, что только в Enterprise.",
    type: "website",
    url: "https://aevion.io/pricing/compare",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION — Полная матрица тарифов",
    description: "43 модуля × Free / Lite / Medium / Full / Universe / Enterprise. Полное сравнение.",
  },
  alternates: {
    canonical: "/pricing/compare",
  },
};

export default function PricingCompareLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
