import type { Metadata } from "next";

// SEO metadata for the QVenture surface. The page itself is a client component
// ("use client") and can't export metadata, so this server-component layout
// supplies it. The dynamic /qventure/a/[id] route overrides with its own
// generateMetadata (per-report title + OG image).

const TITLE = "QVenture — AI Investment Analyst for Any Business";
const DESCRIPTION =
  "Fund-grade due diligence in seconds. A transparent 0–100 quant score across 8 factors, "
  + "a four-role expert council (scientist, data analyst, economist, lawyer), and a concrete "
  + "entry strategy — ticket size, valuation band, staged tranches, risk-adjusted return.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "AI investment analyst", "startup due diligence", "venture screening",
    "deal scoring", "angel investing", "micro VC", "investment memo", "AEVION",
  ],
  alternates: { canonical: "/qventure" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    url: "/qventure",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function QVentureLayout({ children }: { children: React.ReactNode }) {
  return children;
}
