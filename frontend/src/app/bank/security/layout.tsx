import type { Metadata } from "next";
import { BreadcrumbsJsonLd } from "../_components/BreadcrumbsJsonLd";
import { getSiteUrl } from "@/lib/siteUrl";

const SITE = getSiteUrl();

export const metadata: Metadata = {
  title: "Security — AEVION Bank",
  description: "How AEVION Bank protects your money: biometric guards, Ed25519 signatures via QSign, on-device storage, anomaly detection, full data export. Defence in depth, not paperwork.",
  openGraph: {
    title: "AEVION Bank Security",
    description: "Cryptographic guarantees, on-device storage, biometric guards.",
    type: "article",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Bank Security",
    description: "Defence in depth, not paperwork.",
  },
  robots: { index: true, follow: true },
  alternates: { canonical: "/bank/security" },
};

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Defence in depth, not paperwork",
  name: "AEVION Bank Security Model",
  description:
    "How AEVION Bank protects your money: biometric guards, Ed25519 signatures via QSign, on-device storage, anomaly detection, full data export.",
  inLanguage: ["en", "ru", "kk"],
  about: ["Security", "Ed25519", "WebAuthn", "QSign", "AEVION Bank"],
  publisher: {
    "@type": "Organization",
    name: "AEVION",
    url: SITE,
  },
  mainEntityOfPage: {
    "@type": "WebPage",
    "@id": `${SITE}/bank/security`,
  },
};

export default function SecurityLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <BreadcrumbsJsonLd path="/bank/security" name="Security Model" />
      {children}
    </>
  );
}
