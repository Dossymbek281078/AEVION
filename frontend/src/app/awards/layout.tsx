import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/siteUrl";

const SITE = getSiteUrl();

export const metadata: Metadata = {
  title: "AEVION Awards · Music & Film recognition with AEC payouts",
  description:
    "Submit AI-music or AI-film to the AEVION Awards. Validators on Planet certify originality, the community votes, top-3 receive AEC prizes settled to your AEVION Bank wallet.",
  openGraph: {
    title: "AEVION Awards — recognition tied to revenue",
    description: "QRight register → submit → Planet validate → AEC payout.",
    type: "website",
    siteName: "AEVION",
  },
  twitter: { card: "summary_large_image", title: "AEVION Awards", description: "AI-music & AI-film awards with AEC prizes." },
  alternates: { canonical: "/awards" },
};

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Recognition, tied to revenue.",
  name: "AEVION Awards",
  description:
    "AEVION Awards hub: creative recognition wired to QRight authorship, Planet validator quorum and Bank AEC payouts. Music wave 1, film wave 2.",
  inLanguage: ["en", "ru", "kk"],
  about: ["AEVION Awards", "Music Awards", "Film Awards", "Creator Economy", "Planet Validators"],
  publisher: { "@type": "Organization", name: "AEVION", url: SITE },
  mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE}/awards` },
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "AEVION", item: SITE },
    { "@type": "ListItem", position: 2, name: "Awards", item: `${SITE}/awards` },
  ],
};

export default function AwardsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {children}
    </>
  );
}
