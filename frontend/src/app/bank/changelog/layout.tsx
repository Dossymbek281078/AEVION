import type { Metadata } from "next";
import { BreadcrumbsJsonLd } from "../_components/BreadcrumbsJsonLd";

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
      <BreadcrumbsJsonLd path="/bank/changelog" name="Changelog" />
      {children}
    </>
  );
}
