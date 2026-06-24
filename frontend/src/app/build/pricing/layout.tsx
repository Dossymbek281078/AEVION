import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing & Plans — AEVION QBuild",
  description:
    "AEVION QBuild pricing — Developer, Build, Scale, and Enterprise plans for construction hiring. Post projects, source crews, and message contractors directly. 20% off on yearly billing.",
  alternates: { canonical: "https://aevion.com/build/pricing" },
  openGraph: {
    title: "Pricing & Plans — AEVION QBuild",
    description:
      "Developer, Build, Scale, and Enterprise plans for construction hiring on AEVION QBuild. 20% off yearly.",
    type: "website",
    siteName: "AEVION QBuild",
    url: "https://aevion.com/build/pricing",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing & Plans — AEVION QBuild",
    description: "Construction hiring plans on AEVION QBuild. 20% off yearly billing.",
  },
};

// Prices shift, so we keep monetary values off the structured data and only
// describe the offer catalogue + breadcrumb. The page itself renders the live
// numbers fetched from the billing API.
const BREADCRUMB_LD = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "QBuild", item: "https://aevion.com/build" },
    {
      "@type": "ListItem",
      position: 2,
      name: "Pricing",
      item: "https://aevion.com/build/pricing",
    },
  ],
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
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
