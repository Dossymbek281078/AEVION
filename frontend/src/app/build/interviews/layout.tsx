import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Interviews — AEVION QBuild",
  description:
    "Schedule, track, and manage construction hiring interviews on AEVION QBuild. Keep candidate conversations, time slots, and outcomes in one place.",
  alternates: { canonical: "https://aevion.app/build/interviews" },
  openGraph: {
    title: "Interviews — AEVION QBuild",
    description:
      "Schedule and manage construction hiring interviews on AEVION QBuild.",
    type: "website",
    siteName: "AEVION QBuild",
    url: "https://aevion.app/build/interviews",
  },
  twitter: {
    card: "summary",
    title: "Interviews — AEVION QBuild",
    description: "Schedule and manage construction hiring interviews on AEVION QBuild.",
  },
};

const BREADCRUMB_LD = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "QBuild", item: "https://aevion.app/build" },
    {
      "@type": "ListItem",
      position: 2,
      name: "Interviews",
      item: "https://aevion.app/build/interviews",
    },
  ],
};

export default function InterviewsLayout({ children }: { children: React.ReactNode }) {
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
