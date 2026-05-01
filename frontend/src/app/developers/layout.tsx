import { getSiteUrl } from "@/lib/siteUrl";

const SITE = getSiteUrl();

const techArticleJsonLd = {
  "@context": "https://schema.org",
  "@type": "TechArticle",
  headline: "Build on AEVION — REST + SDK + webhooks.",
  name: "AEVION Developers",
  description:
    "Developer portal for the AEVION Trust OS: 6 REST APIs (QRight, QSign, Bureau, Planet, QTrade, Quantum Shield), TypeScript SDKs, HMAC-signed webhooks with retry, sandbox keys, OpenAPI 3.0.",
  inLanguage: ["en"],
  proficiencyLevel: "Beginner",
  about: ["AEVION", "REST API", "TypeScript SDK", "Webhooks", "OpenAPI"],
  publisher: { "@type": "Organization", name: "AEVION", url: SITE },
  mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE}/developers` },
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "AEVION", item: SITE },
    { "@type": "ListItem", position: 2, name: "Developers", item: `${SITE}/developers` },
  ],
};

const apiReferenceJsonLd = {
  "@context": "https://schema.org",
  "@type": "APIReference",
  name: "AEVION REST API",
  description: "Public REST API across QRight, QSign, Bureau, Planet, QTrade and Quantum Shield modules.",
  url: `${SITE}/api/openapi.json`,
  programmingModel: "REST",
  targetPlatform: "Web",
};

export default function DevelopersLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(techArticleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(apiReferenceJsonLd) }} />
      {children}
    </>
  );
}
