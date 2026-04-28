import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in to AEVION — one identity for the whole Trust OS",
  description:
    "One AEVION account unlocks QRight authorship, QSign signatures, Bureau certificates, Planet validators, AEVION Bank, Awards, CyberChess and more. Email or social login.",
  openGraph: {
    title: "Sign in to AEVION",
    description: "One identity unlocks every module — registry, signatures, bureau, validators, bank.",
    type: "website",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sign in to AEVION",
    description: "One identity for the whole Trust OS.",
  },
  alternates: { canonical: "/auth" },
  robots: { index: true, follow: true },
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "AEVION", item: "https://aevion.app" },
    { "@type": "ListItem", position: 2, name: "Sign in", item: "https://aevion.app/auth" },
  ],
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
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
