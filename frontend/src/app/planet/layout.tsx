import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/siteUrl";

const SITE = getSiteUrl();

export const metadata: Metadata = {
  title: "AEVION Planet — validator network for AI artifacts",
  description:
    "Planet is the public validator quorum for AEVION. Submit AI music, films, code or web artifacts; independent validators co-sign verdicts on-chain. Authorship from QRight, payouts via AEC into Bank.",
  openGraph: {
    title: "AEVION Planet — on-chain validator quorum for AI artifacts",
    description:
      "Independent validators certify originality on-chain. Submit through QRight, route to Bank. The transparent jury for AI music, film, code and web.",
    type: "website",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Planet",
    description: "Public validator quorum for AI artifacts. QRight → Planet → Bank.",
  },
  alternates: { canonical: "/planet" },
};

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Planet — the public validator quorum.",
  name: "AEVION Planet",
  description:
    "AEVION Planet is a transparent on-chain quorum: validators independently sign verdicts on AI artifact submissions. Powers Awards, Royalties and the QRight authorship rail.",
  inLanguage: ["en", "ru", "kk"],
  about: ["AEVION Planet", "Validator Network", "On-chain Verdicts", "AI Provenance", "QRight"],
  publisher: { "@type": "Organization", name: "AEVION", url: SITE },
  mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE}/planet` },
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "AEVION", item: SITE },
    { "@type": "ListItem", position: 2, name: "Planet", item: `${SITE}/planet` },
  ],
};

export default function PlanetLayout({ children }: { children: React.ReactNode }) {
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
