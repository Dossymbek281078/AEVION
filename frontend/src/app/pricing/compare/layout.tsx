import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Сравнение тарифов AEVION — все модули и сроки",
  description:
    "Полная матрица: Free, сроки Lite, Medium, Pro, Full, Max и Enterprise. Любой платный срок открывает все модули AEVION — IP, AI, финтех, потребительские продукты — со статусами LIVE / BETA / SOON; пять приложений продаются и отдельно.",
  openGraph: {
    title: "Сравнение тарифов AEVION — полная матрица",
    description:
      "Все модули и все сроки в одной таблице. Что входит в любой платный срок, что продаётся отдельно, что только в Enterprise.",
    type: "website",
    url: "https://aevion.app/pricing/compare",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION — Полная матрица тарифов",
    description: "Все модули × Free / Lite / Medium / Pro / Full / Max / Enterprise. Полное сравнение.",
  },
  alternates: {
    canonical: "/pricing/compare",
  },
};

export default function PricingCompareLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
