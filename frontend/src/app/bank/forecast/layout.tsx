import type { Metadata } from "next";
import { BreadcrumbsJsonLd } from "../_components/BreadcrumbsJsonLd";

export const metadata: Metadata = {
  title: "Wealth forecast — AEVION Bank",
  description: "Wealth forecast for your AEVION Bank wallet — three scenarios (conservative · realistic · optimistic) across 30 / 90 / 365-day horizons with goal ETAs.",
  openGraph: {
    title: "AEVION Bank Wealth Forecast",
    description: "Three scenarios, three horizons, projected goal ETAs.",
    type: "article",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Bank Wealth Forecast",
    description: "Project the next year of your wallet.",
  },
  robots: { index: true, follow: true },
  alternates: { canonical: "/bank/forecast" },
};

export default function ForecastLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BreadcrumbsJsonLd path="/bank/forecast" name="Wealth Forecast" />
      {children}
    </>
  );
}
