import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Construction Salary Statistics — AEVION QBuild",
  description:
    "Real construction salary analytics on AEVION QBuild — pay ranges by role, skill, and city, built from live vacancy data. Benchmark your rate before you apply or hire.",
  alternates: { canonical: "https://aevion.com/build/salary" },
  openGraph: {
    title: "Construction Salary Statistics — AEVION QBuild",
    description:
      "Construction pay ranges by role, skill, and city — built from live vacancy data on AEVION QBuild.",
    type: "website",
    siteName: "AEVION QBuild",
    url: "https://aevion.com/build/salary",
  },
  twitter: {
    card: "summary_large_image",
    title: "Construction Salary Statistics — AEVION QBuild",
    description: "Construction pay ranges by role, skill, and city on AEVION QBuild.",
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
      name: "Salary statistics",
      item: "https://aevion.com/build/salary",
    },
  ],
};

export default function SalaryLayout({ children }: { children: React.ReactNode }) {
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
