import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/siteUrl";

// Server-side SEO + JSON-LD for the AEVION Coach student dashboard.
// The page is client-rendered (it manages live coaching sessions and goal
// tracking) so we keep metadata + structured data in the layout.

const SITE = getSiteUrl();
const CANONICAL = `${SITE}/coach`;

export const metadata: Metadata = {
  title: "AEVION Coach — live coaching sessions & goal tracker",
  description:
    "Run live coaching sessions with topic and starting FEN, track elapsed time, finish with notes. Set goals, link them to sessions, mark complete. Anonymous-first.",
  alternates: { canonical: CANONICAL },
  keywords: [
    "AEVION",
    "Coach",
    "coaching",
    "goal tracker",
    "chess coaching",
    "training session",
    "self-improvement",
  ],
  openGraph: {
    type: "website",
    title: "AEVION Coach — live coaching dashboard",
    description:
      "Start a coaching session, track time, finish with notes. Create and link goals. Built for self-paced learners.",
    url: CANONICAL,
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Coach",
    description: "Live coaching sessions and goal tracker on AEVION.",
  },
};

const appJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "@id": CANONICAL,
  name: "AEVION Coach",
  description:
    "Coaching dashboard with live timed sessions (topic + starting FEN), session notes, and a goal tracker that links goals to specific sessions.",
  applicationCategory: "EducationalApplication",
  operatingSystem: "Web",
  url: CANONICAL,
  inLanguage: ["en"],
  isPartOf: { "@type": "WebSite", name: "AEVION", url: SITE },
  publisher: { "@type": "Organization", name: "AEVION", url: SITE },
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Live coaching sessions with elapsed time tracking",
    "Topic and starting FEN for chess coaching",
    "Session notes on completion",
    "Goal tracker with optional session linking",
    "Filter goals by status (open / completed)",
    "Anonymous-first with stable clientId",
  ],
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "AEVION", item: SITE },
    { "@type": "ListItem", position: 2, name: "Coach", item: CANONICAL },
  ],
};

export default function CoachLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(appJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {children}
    </>
  );
}
