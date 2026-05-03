import type { Metadata } from "next";
import { BreadcrumbsJsonLd } from "../_components/BreadcrumbsJsonLd";

export const metadata: Metadata = {
  title: "Net worth — AEVION Bank",
  description: "Stacked-asset view of net worth across wallet, vaults, royalty streams, and chess winnings.",
  openGraph: {
    title: "AEVION Bank Net Worth",
    description: "Stacked-asset net worth tracker.",
    type: "article",
    siteName: "AEVION",
  },
  twitter: { card: "summary_large_image", title: "AEVION Bank Net Worth", description: "Stacked-asset net worth." },
  robots: { index: true, follow: true },
  alternates: { canonical: "/bank/networth" },
};

export default function NetworthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BreadcrumbsJsonLd path="/bank/networth" name="Net Worth Tracker" />
      {children}
    </>
  );
}
