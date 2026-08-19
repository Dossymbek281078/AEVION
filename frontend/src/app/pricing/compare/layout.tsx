import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Сравнение тарифов AEVION — все модули × 4 тарифа",
  description:
    "Полная матрица: что входит в Free, Lite, Medium, Full, Universe и Enterprise. Все все модули AEVION — IP, AI, финтех, потребительские продукты — со статусами LIVE / BETA / SOON и ценами add-on.",
  openGraph: {
    title: "Сравнение тарифов AEVION — полная матрица",
    description:
      "Все все модули × 4 тарифа в одной таблице. Что включено, что доступно как add-on, что только в Enterprise.",
    type: "website",
    url: "https://aevion.app/pricing/compare",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION — Полная матрица тарифов",
    description: "все модули × Free / Lite / Medium / Full / Universe / Enterprise. Полное сравнение.",
  },
  alternates: {
    canonical: "/pricing/compare",
  },
};

export default function PricingCompareLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
