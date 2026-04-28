import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AEVION · Deep demo — architecture & data flows",
  description:
    "Deep walk-through of the AEVION Wave 1 architecture: Auth → QRight → QSign → Bureau data flows, Planet validator quorum, parallel development tracks and direct links to every live module.",
  alternates: { canonical: "/demo/deep" },
  openGraph: {
    title: "AEVION Deep Demo — architecture under the hood",
    description: "Wave 1 architecture, data flows, validator quorum, parallel tracks.",
    type: "article",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Deep Demo",
    description: "Architecture and data flows of the trust pipeline.",
  },
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "AEVION", item: "https://aevion.app" },
    { "@type": "ListItem", position: 2, name: "Demo", item: "https://aevion.app/demo" },
    { "@type": "ListItem", position: 3, name: "Deep", item: "https://aevion.app/demo/deep" },
  ],
};

export default function DemoDeepLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {children}
    </>
  );
}
