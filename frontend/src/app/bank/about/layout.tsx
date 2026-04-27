import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About AEVION Bank — wallet for the trust graph",
  description: "Why AEVION Bank exists: a creator-first wallet where royalties land automatically, credit is gated by Trust Score, and every social moment can carry money.",
  openGraph: {
    title: "About AEVION Bank",
    description: "Wallet for the trust graph: royalties · credit · social payments · in 3 languages.",
    type: "article",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "About AEVION Bank",
    description: "Wallet where money composes with creative work.",
  },
  robots: { index: true, follow: true },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
