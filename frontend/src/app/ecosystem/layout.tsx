import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/siteUrl";

// Server-side SEO + JSON-LD for the AEVION Ecosystem cross-module hub.
// The page itself is client-rendered (it fetches an activity feed + a
// module health-matrix and exposes interactive filters), so metadata and
// structured data live in this layout.

const SITE = getSiteUrl();
const CANONICAL = `${SITE}/ecosystem`;

export const metadata: Metadata = {
  title: "AEVION Ecosystem — cross-module activity & health matrix",
  description:
    "Cross-module hub: merged activity feed from qsocial, qmedia, qnews, qright, planet and earnings, plus a health matrix coloured by tier. Live view of the AEVION OS.",
  alternates: { canonical: CANONICAL },
  keywords: [
    "AEVION",
    "ecosystem",
    "module health",
    "activity feed",
    "qsocial",
    "qmedia",
    "qnews",
    "qright",
    "planet",
  ],
  openGraph: {
    type: "website",
    title: "AEVION Ecosystem — cross-module hub",
    description:
      "Merged activity from every AEVION module plus a health matrix. The single dashboard for the Trust OS.",
    url: CANONICAL,
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Ecosystem",
    description: "Cross-module activity feed and health matrix.",
  },
};

const appJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "@id": CANONICAL,
  name: "AEVION Ecosystem",
  description:
    "Single dashboard that merges activity from qsocial, qmedia, qnews, qright, planet and earnings, with a per-module health matrix coloured by tier.",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: CANONICAL,
  inLanguage: ["en"],
  isPartOf: { "@type": "WebSite", name: "AEVION", url: SITE },
  publisher: { "@type": "Organization", name: "AEVION", url: SITE },
  featureList: [
    "Merged activity feed across modules",
    "Per-source filter chips with stable counters",
    "Mine-only toggle for personal activity",
    "Module health matrix coloured by tier",
    "User-touch indicator on modules with earnings activity",
  ],
};

const dataFeedJsonLd = {
  "@context": "https://schema.org",
  "@type": "DataFeed",
  name: "AEVION Ecosystem activity",
  description:
    "Merged activity stream across qsocial, qmedia, qnews, qright, planet and earnings. Served by GET /api/ecosystem/activity.",
  encodingFormat: "application/json",
  publisher: { "@type": "Organization", name: "AEVION", url: SITE },
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "AEVION", item: SITE },
    { "@type": "ListItem", position: 2, name: "Ecosystem", item: CANONICAL },
  ],
};

export default function EcosystemLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(appJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(dataFeedJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {children}
    </>
  );
}
