import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "/awards/music" },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Music Awards",
    description: "Pre-Grammy era for AI music. QRight authorship, Planet validators, AEC payouts.",
  },
};

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Pre-Grammy era for AI music.",
  name: "AEVION Music Awards",
  description:
    "AEVION Music Awards: submit through Planet (artifact type music), get a compliance certificate and AEC payout into AEVION Bank.",
  inLanguage: ["en", "ru", "kk"],
  about: ["AEVION Music Awards", "AI Music", "Creator Economy", "QRight", "Planet Validators"],
  publisher: { "@type": "Organization", name: "AEVION", url: "https://aevion.app" },
  mainEntityOfPage: { "@type": "WebPage", "@id": "https://aevion.app/awards/music" },
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "AEVION", item: "https://aevion.app" },
    { "@type": "ListItem", position: 2, name: "Awards", item: "https://aevion.app/awards" },
    { "@type": "ListItem", position: 3, name: "Music", item: "https://aevion.app/awards/music" },
  ],
};

export default function MusicAwardsLayout({ children }: { children: React.ReactNode }) {
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
