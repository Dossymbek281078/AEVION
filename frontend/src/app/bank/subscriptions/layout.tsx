import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Subscriptions — AEVION Bank",
  description: "Smart subscription scanner for your AEVION Bank wallet — flags stale, expensive, and duplicate recurring charges with one-tap pause.",
  openGraph: {
    title: "AEVION Bank Subscriptions",
    description: "Catch the leaks: stale, expensive, duplicate recurring charges flagged automatically.",
    type: "article",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Bank Subscriptions",
    description: "Catch the leaks.",
  },
  robots: { index: true, follow: true },
  alternates: { canonical: "/bank/subscriptions" },
};

export default function SubscriptionsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
