import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trust Score — AEVION Bank",
  description: "How AEVION Bank computes your Trust Score across 8 factors — banking activity, network, IP portfolio, ecosystem participation. The reputation that gates credit.",
  openGraph: {
    title: "AEVION Trust Score",
    description: "Reputation-gated credit. 8 factors. 4 tiers. No paperwork.",
    type: "article",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Trust Score",
    description: "Reputation-gated credit, computed across 8 factors.",
  },
  robots: { index: true, follow: true },
};

export default function TrustLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
