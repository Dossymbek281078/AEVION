import type { Metadata } from "next";
import { BreadcrumbsJsonLd } from "../_components/BreadcrumbsJsonLd";

export const metadata: Metadata = {
  title: "Money Flow — AEVION Bank",
  description: "Sankey-style visualisation of money moving through your AEVION wallet — sources on the left (banking, royalties, chess, planet), categories on the right (subscriptions, tips, contacts, untagged), net flow at the bottom.",
  openGraph: {
    title: "AEVION Bank Money Flow",
    description: "See where money comes in and where it goes — at a glance.",
    type: "article",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Bank Money Flow",
    description: "Sankey of inflows and outflows.",
  },
  robots: { index: true, follow: true },
  alternates: { canonical: "/bank/flow" },
};

export default function FlowLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BreadcrumbsJsonLd path="/bank/flow" name="Money Flow" />
      {children}
    </>
  );
}
