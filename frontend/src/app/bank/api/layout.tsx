import type { Metadata } from "next";
import { BreadcrumbsJsonLd } from "../_components/BreadcrumbsJsonLd";

const techArticleJsonLd = {
  "@context": "https://schema.org",
  "@type": "TechArticle",
  headline: "AEVION Bank API Reference",
  name: "AEVION Bank API",
  description:
    "Endpoints, request shapes, sample responses, copy-ready curl examples for the AEVION Bank API surface.",
  proficiencyLevel: "Intermediate",
  inLanguage: ["en", "ru", "kk"],
  about: ["AEVION Bank", "REST API", "Wallet API", "QSign", "JWT"],
  publisher: { "@type": "Organization", name: "AEVION", url: "https://aevion.app" },
  mainEntityOfPage: {
    "@type": "WebPage",
    "@id": "https://aevion.app/bank/api",
  },
};

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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(techArticleJsonLd) }}
      />
      <BreadcrumbsJsonLd path="/bank/api" name="API Reference" />
      {children}
    </>
  );
}
