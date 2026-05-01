import type { Metadata } from "next";
import { BreadcrumbsJsonLd } from "../_components/BreadcrumbsJsonLd";
import { getSiteUrl } from "@/lib/siteUrl";

const SITE = getSiteUrl();

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Every shipped feature.",
  name: "AEVION Bank Changelog",
  description:
    "Public timeline of every shipped AEVION Bank feature — wallet, savings, royalties, recurring payments, security, social, and developer surfaces.",
  inLanguage: ["en", "ru", "kk"],
  about: ["AEVION Bank", "Changelog", "Release notes"],
  publisher: { "@type": "Organization", name: "AEVION", url: SITE },
  mainEntityOfPage: {
    "@type": "WebPage",
    "@id": `${SITE}/bank/changelog`,
  },
};

export const metadata: Metadata = {
  title: "Changelog — AEVION Bank",
  description: "Public timeline of every shipped AEVION Bank feature — wallet, savings, royalties, recurring payments, security, social, and developer surfaces.",
  openGraph: {
    title: "AEVION Bank Changelog",
    description: "Every shipped feature, by month.",
    type: "article",
    siteName: "AEVION",
  },
  twitter: { card: "summary_large_image", title: "AEVION Bank Changelog", description: "Every shipped feature." },
  robots: { index: true, follow: true },
  alternates: { canonical: "/bank/changelog" },
};

export default function ChangelogLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <BreadcrumbsJsonLd path="/bank/changelog" name="Changelog" />
      {children}
    </>
  );
}
