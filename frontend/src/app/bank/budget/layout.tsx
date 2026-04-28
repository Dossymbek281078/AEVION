import type { Metadata } from "next";
import { BreadcrumbsJsonLd } from "../_components/BreadcrumbsJsonLd";

export const metadata: Metadata = {
  title: "Budget — AEVION Bank",
  description: "Monthly category budgets for your AEVION Bank wallet — set caps per category, watch real-time spend pace, and project end-of-month totals before they breach.",
  openGraph: {
    title: "AEVION Bank Budget",
    description: "Monthly caps with real-time pace and end-of-month projections.",
    type: "article",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Bank Budget",
    description: "Caps, pace, projection.",
  },
  robots: { index: true, follow: true },
  alternates: { canonical: "/bank/budget" },
};

export default function BudgetLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BreadcrumbsJsonLd path="/bank/budget" name="Monthly Budget" />
      {children}
    </>
  );
}
