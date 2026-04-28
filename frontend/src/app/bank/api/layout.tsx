import type { Metadata } from "next";
import { BreadcrumbsJsonLd } from "../_components/BreadcrumbsJsonLd";

export const metadata: Metadata = {
  title: "AEVION Bank — API Reference",
  description: "Endpoints, request shapes, sample responses, copy-ready curl examples for the AEVION Bank API surface.",
  openGraph: {
    title: "AEVION Bank API Reference",
    description: "Public API surface for wallets, transfers, signatures and ecosystem aggregates.",
    type: "website",
    siteName: "AEVION",
  },
  robots: { index: true, follow: true },
};

export default function ApiDocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BreadcrumbsJsonLd path="/bank/api" name="API Reference" />
      {children}
    </>
  );
}
