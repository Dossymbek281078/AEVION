import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Construction Vacancies & Jobs — AEVION QBuild",
  description:
    "Browse open construction vacancies on AEVION QBuild. Filter by city, salary, and skills. Apply directly to crews, contractors, and projects — no recruiters in between.",
  alternates: { canonical: "https://aevion.com/build/vacancies" },
  openGraph: {
    title: "Construction Vacancies & Jobs — AEVION QBuild",
    description:
      "Open construction vacancies — filter by city, salary, and skills. Apply directly on AEVION QBuild.",
    type: "website",
    siteName: "AEVION QBuild",
    url: "https://aevion.com/build/vacancies",
  },
  twitter: {
    card: "summary_large_image",
    title: "Construction Vacancies & Jobs — AEVION QBuild",
    description: "Open construction vacancies. Apply directly on AEVION QBuild.",
  },
};

// CollectionPage marks this as the canonical listing of job postings; the
// individual vacancy pages carry the per-job JobPosting JSON-LD that Google
// Jobs ingests. Breadcrumb gives the listing its place in the site tree.
const COLLECTION_LD = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "Construction Vacancies",
  description:
    "Listing of open construction vacancies on AEVION QBuild — filter by city, salary, and skills.",
  url: "https://aevion.com/build/vacancies",
  isPartOf: { "@type": "WebSite", name: "AEVION QBuild", url: "https://aevion.com/build" },
};

const BREADCRUMB_LD = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "QBuild", item: "https://aevion.com/build" },
    {
      "@type": "ListItem",
      position: 2,
      name: "Vacancies",
      item: "https://aevion.com/build/vacancies",
    },
  ],
};

export default function VacanciesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(COLLECTION_LD) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB_LD) }}
      />
      {children}
    </>
  );
}
