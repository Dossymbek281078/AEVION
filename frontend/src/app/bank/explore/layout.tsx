import type { Metadata } from "next";
import { BreadcrumbsJsonLd } from "../_components/BreadcrumbsJsonLd";

export const metadata: Metadata = {
  title: "AEVION Bank — Explore",
  description: "Catalog of every AEVION Bank capability: wallet, gifts, statement, inbox, leaderboard, share profile, embed badge, scan-to-pay, API and more.",
  openGraph: {
    title: "AEVION Bank — Explore",
    description: "Find every wallet feature in one place. 11 surfaces and counting.",
    type: "website",
    siteName: "AEVION",
  },
  robots: { index: true, follow: true },
};

export default function ExploreLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BreadcrumbsJsonLd path="/bank/explore" name="Feature Catalog" />
      {children}
    </>
  );
}
