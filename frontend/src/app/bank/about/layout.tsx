import type { Metadata } from "next";
import { BreadcrumbsJsonLd } from "../_components/BreadcrumbsJsonLd";
import { getSiteUrl } from "@/lib/siteUrl";

const SITE = getSiteUrl();

export const metadata: Metadata = {
  title: "About AEVION Bank — wallet for the trust graph",
  description: "Why AEVION Bank exists: a creator-first wallet where royalties land automatically, credit is gated by Trust Score, and every social moment can carry money.",
  openGraph: {
    title: "About AEVION Bank",
    description: "Wallet for the trust graph: royalties · credit · social payments · in 3 languages.",
    type: "article",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "About AEVION Bank",
    description: "Wallet where money composes with creative work.",
  },
  robots: { index: true, follow: true },
  alternates: { canonical: "/bank/about" },
};

// Schema.org Article JSON-LD — surfaces /bank/about as a published article
// to Google with name, description, headline, and the AEVION publisher.
const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Wallet for the trust graph",
  name: "About AEVION Bank",
  description:
    "Why AEVION Bank exists: a creator-first wallet where royalties land automatically, credit is gated by Trust Score, and every social moment can carry money.",
  inLanguage: ["en", "ru", "kk"],
  about: ["AEVION Bank", "Trust Score", "Creator economy"],
  publisher: {
    "@type": "Organization",
    name: "AEVION",
    url: SITE,
  },
  mainEntityOfPage: {
    "@type": "WebPage",
    "@id": `${SITE}/bank/about`,
  },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <BreadcrumbsJsonLd path="/bank/about" name="About AEVION Bank" />
      {children}
    </>
  );
}
