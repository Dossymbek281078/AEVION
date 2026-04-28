import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AEVION · Live ecosystem demo — 27 nodes, one trust pipeline",
  description:
    "Walk through every AEVION module: registry → signature → bureau → compliance → wallet. Live API metrics. From idea to court-grade certificate in 90 seconds.",
  openGraph: {
    title: "AEVION ecosystem — live product demo",
    description: "12 live MVPs across IP, signatures, bureau, compliance, AI, banking, chess. Walk the full trust pipeline.",
    type: "website",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION live demo",
    description: "Walk every module of the trust ecosystem.",
  },
  alternates: { canonical: "/demo" },
};

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Live ecosystem demo — 27 nodes, one trust pipeline.",
  name: "AEVION Live Demo",
  description:
    "Walk every AEVION module: registry → signature → bureau → compliance → wallet. Live API metrics, real backend, real data. From idea to court-grade certificate in 90 seconds.",
  inLanguage: ["en", "ru", "kk"],
  about: ["AEVION", "Trust Infrastructure", "QRight", "QSign", "Bureau", "Planet", "Bank"],
  publisher: { "@type": "Organization", name: "AEVION", url: "https://aevion.app" },
  mainEntityOfPage: { "@type": "WebPage", "@id": "https://aevion.app/demo" },
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "AEVION", item: "https://aevion.app" },
    { "@type": "ListItem", position: 2, name: "Demo", item: "https://aevion.app/demo" },
  ],
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
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
