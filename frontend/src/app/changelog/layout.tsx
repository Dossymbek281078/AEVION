import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AEVION Changelog — public timeline of releases",
  description:
    "Public timeline of AEVION releases across QRight, QSign, Bureau, Planet, Bank, Awards, CyberChess, QCoreAI, Multichat. Every entry links to the surfaces that shipped.",
  openGraph: {
    title: "AEVION Changelog — every release, in public",
    description: "Open log of what shipped across all 27 nodes — by date, by module, with links to live surfaces.",
    type: "website",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Changelog",
    description: "Public release timeline across all AEVION modules.",
  },
  alternates: { canonical: "/changelog" },
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "AEVION", item: "https://aevion.app" },
    { "@type": "ListItem", position: 2, name: "Changelog", item: "https://aevion.app/changelog" },
  ],
};

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "AEVION public release log.",
  name: "AEVION Changelog",
  description: "Cross-module release timeline. Every entry pins a date, a kind (feat / fix / docs) and the surfaces that shipped.",
  inLanguage: ["en"],
  about: ["AEVION", "Release Notes", "Product Changelog"],
  publisher: { "@type": "Organization", name: "AEVION", url: "https://aevion.app" },
  mainEntityOfPage: { "@type": "WebPage", "@id": "https://aevion.app/changelog" },
};

export default function ChangelogLayout({ children }: { children: React.ReactNode }) {
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
