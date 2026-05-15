import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/siteUrl";
import { getApiBase } from "@/lib/apiBase";

// Server-side SEO + JSON-LD for the public Planet activity feed. The page
// is client-rendered (live polling) so metadata lives here.

const SITE = getSiteUrl();
const CANONICAL = `${SITE}/planet/activity`;
const OG_IMAGE = `${getApiBase()}/api/planet/og.svg`;

export const metadata: Metadata = {
  title: "Planet activity feed — public validator stream | AEVION",
  description:
    "Live chronological feed of AEVION Planet validator activity: new submissions, issued certificates, revocations and quorum votes. Public, auto-refreshing every minute.",
  alternates: { canonical: CANONICAL },
  keywords: [
    "AEVION",
    "Planet",
    "validator",
    "activity feed",
    "AI provenance",
    "transparency",
    "on-chain verdicts",
  ],
  openGraph: {
    type: "website",
    title: "Planet activity feed — AEVION",
    description:
      "Live, public stream of validator activity on AEVION Planet. Submissions, certificates, votes — auto-refresh every minute.",
    url: CANONICAL,
    siteName: "AEVION",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "AEVION Planet activity" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Planet activity feed",
    description: "Live public validator stream on AEVION Planet.",
    images: [OG_IMAGE],
  },
};

const collectionJsonLd = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "@id": CANONICAL,
  name: "AEVION Planet activity feed",
  description:
    "Real-time, chronological feed of every Planet event: submissions, certificates, revocations and validator votes. Auto-refreshes every minute.",
  inLanguage: ["en"],
  isPartOf: { "@type": "WebSite", name: "AEVION", url: SITE },
  publisher: { "@type": "Organization", name: "AEVION", url: SITE },
  mainEntity: {
    "@type": "DataFeed",
    name: "Planet activity",
    description: "Public validator activity stream from /api/planet/activity.",
    encodingFormat: "application/json",
  },
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "AEVION", item: SITE },
    { "@type": "ListItem", position: 2, name: "Planet", item: `${SITE}/planet` },
    { "@type": "ListItem", position: 3, name: "Activity", item: CANONICAL },
  ],
};

export default function PlanetActivityLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {children}
    </>
  );
}
