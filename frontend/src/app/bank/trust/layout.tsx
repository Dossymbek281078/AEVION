import type { Metadata } from "next";
import { BreadcrumbsJsonLd } from "../_components/BreadcrumbsJsonLd";

export const metadata: Metadata = {
  title: "Trust Score — AEVION Bank",
  description: "How AEVION Bank computes your Trust Score across 8 factors — banking activity, network, IP portfolio, ecosystem participation. The reputation that gates credit.",
  openGraph: {
    title: "AEVION Trust Score",
    description: "Reputation-gated credit. 8 factors. 4 tiers. No paperwork.",
    type: "article",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Trust Score",
    description: "Reputation-gated credit, computed across 8 factors.",
  },
  robots: { index: true, follow: true },
  alternates: { canonical: "/bank/trust" },
};

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Reputation, computed.",
  name: "AEVION Trust Score",
  description:
    "How AEVION Bank computes your Trust Score across 8 factors — banking activity, network, IP portfolio, ecosystem participation. The reputation that gates credit.",
  inLanguage: ["en", "ru", "kk"],
  about: ["Trust Score", "Reputation", "AEVION Bank", "Credit"],
  publisher: { "@type": "Organization", name: "AEVION", url: "https://aevion.app" },
  mainEntityOfPage: {
    "@type": "WebPage",
    "@id": "https://aevion.app/bank/trust",
  },
};

export default function TrustLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <BreadcrumbsJsonLd path="/bank/trust" name="Trust Score" />
      {children}
    </>
  );
}
