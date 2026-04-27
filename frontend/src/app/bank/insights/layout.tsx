import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Insights — AEVION Bank",
  description: "Spending insights for your AEVION Bank wallet — auto-categorised outgoing transfers, period-over-period comparison, biggest transactions, top recipients.",
  openGraph: {
    title: "AEVION Bank Insights",
    description: "Where your money goes — auto-categorised, period comparison, biggest transactions.",
    type: "article",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Bank Insights",
    description: "Where your money goes.",
  },
  robots: { index: true, follow: true },
};

export default function InsightsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
