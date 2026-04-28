import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "/awards/film" },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Film Awards",
    description: "The first credible AI-film festival. QRight authorship, Planet validators, AEC payouts.",
  },
};

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "The first credible AI-film festival.",
  name: "AEVION Film Awards",
  description:
    "AEVION Film Awards: submit through Planet (artifact type film), pass validator quorum, get a compliance certificate and AEC payout into AEVION Bank.",
  inLanguage: ["en", "ru", "kk"],
  about: ["AEVION Film Awards", "AI Film", "Digital Cinema", "Creator Economy", "QRight", "Planet Validators"],
  publisher: { "@type": "Organization", name: "AEVION", url: "https://aevion.app" },
  mainEntityOfPage: { "@type": "WebPage", "@id": "https://aevion.app/awards/film" },
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "AEVION", item: "https://aevion.app" },
    { "@type": "ListItem", position: 2, name: "Awards", item: "https://aevion.app/awards" },
    { "@type": "ListItem", position: 3, name: "Film", item: "https://aevion.app/awards/film" },
  ],
};

export default function FilmAwardsLayout({ children }: { children: React.ReactNode }) {
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
