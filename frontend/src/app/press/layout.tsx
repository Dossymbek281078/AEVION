import { getSiteUrl } from "@/lib/siteUrl";

const SITE = getSiteUrl();

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "AEVION", item: SITE },
    { "@type": "ListItem", position: 2, name: "Press", item: `${SITE}/press` },
  ],
};

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "AEVION Press Kit — brand, boilerplate, contact.",
  name: "AEVION Press Kit",
  description:
    "Press kit page for AEVION: brand assets, one-liners, 100-word boilerplate, key stats, brand colors and direct media contact.",
  inLanguage: ["en"],
  about: ["AEVION", "Press Kit", "Brand Assets", "Trust Infrastructure"],
  publisher: { "@type": "Organization", name: "AEVION", url: SITE },
  mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE}/press` },
};

export default function PressLayout({ children }: { children: React.ReactNode }) {
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
