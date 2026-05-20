import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Кейсы клиентов AEVION — реальные ROI и метрики",
  description:
    "Истории клиентов AEVION с конкретными метриками: банки, юр. фирмы, стартапы, госсектор и креаторы. Time-to-market, экономия, IP-disputes и Compliance — до и после.",
  openGraph: {
    title: "AEVION — Кейсы клиентов с метриками ROI",
    description:
      "6 case-studies из 4 индустрий. Что считают клиенты: −73% времени на подпись, −74% на регистрацию IP, $2.3M экономии в год.",
    type: "website",
    url: "https://aevion.io/pricing/cases",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Customer Stories",
    description: "Реальные ROI-метрики из банков, юр. фирм, стартапов и госсектора.",
  },
  alternates: {
    canonical: "/pricing/cases",
  },
};

export default function PricingCasesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
