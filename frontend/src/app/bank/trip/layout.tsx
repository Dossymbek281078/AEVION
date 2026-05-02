import type { Metadata } from "next";
import { BreadcrumbsJsonLd } from "../_components/BreadcrumbsJsonLd";

export const metadata: Metadata = {
  title: "Trip tracker — AEVION Bank",
  description: "Date-range budget for trips with daily-pace tracking and projected end-of-trip totals.",
  openGraph: {
    title: "AEVION Bank Trip Tracker",
    description: "Travel-aware budget — daily pace + projection.",
    type: "article",
    siteName: "AEVION",
  },
  twitter: { card: "summary_large_image", title: "AEVION Bank Trip Tracker", description: "Travel-aware budget." },
  robots: { index: true, follow: true },
  alternates: { canonical: "/bank/trip" },
};

export default function TripLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BreadcrumbsJsonLd path="/bank/trip" name="Trip Tracker" />
      {children}
    </>
  );
}
