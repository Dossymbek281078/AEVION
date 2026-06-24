import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Job Match — AEVION QBuild",
  description:
    "AI-powered vacancy analysis on AEVION QBuild. Paste a job or your profile and get an instant match score, skill-gap breakdown, and tailored application tips.",
  alternates: { canonical: "https://aevion.com/build/ai-match" },
  openGraph: {
    title: "AI Job Match — AEVION QBuild",
    description:
      "AI vacancy analysis — instant match score, skill-gap breakdown, and application tips on AEVION QBuild.",
    type: "website",
    siteName: "AEVION QBuild",
    url: "https://aevion.com/build/ai-match",
  },
  twitter: {
    card: "summary",
    title: "AI Job Match — AEVION QBuild",
    description: "AI vacancy analysis with match score and skill-gap breakdown on AEVION QBuild.",
  },
};

const BREADCRUMB_LD = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "QBuild", item: "https://aevion.com/build" },
    {
      "@type": "ListItem",
      position: 2,
      name: "AI Job Match",
      item: "https://aevion.com/build/ai-match",
    },
  ],
};

export default function AiMatchLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB_LD) }}
      />
      {children}
    </>
  );
}
