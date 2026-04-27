import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Help — AEVION Bank",
  description: "Common questions about AEVION Bank — getting started, sending money, saving, credit, privacy, troubleshooting. The bank's manual, in plain language.",
  openGraph: {
    title: "AEVION Bank Help",
    description: "Plain-language answers for the wallet that thinks like a creator.",
    type: "article",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Bank Help",
    description: "Plain-language answers — no FAQ archaeology.",
  },
  robots: { index: true, follow: true },
  alternates: { canonical: "/bank/help" },
};

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
