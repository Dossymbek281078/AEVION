import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AEVION Pricing Calculator — embed",
  description:
    "Embeddable калькулятор стоимости AEVION для блогов и ревьюеров. Iframe-friendly, postMessage resize, source-tracking.",
  robots: {
    index: false,
    follow: false,
  },
  alternates: {
    canonical: "/pricing/calculator/embed",
  },
};

export default function PricingCalculatorEmbedLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
