import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Wealth constellation — AEVION Bank",
  description: "Visual map of your wallet, royalty streams, ecosystem earnings, chess winnings, goals and recurring rules — one constellation.",
  openGraph: {
    title: "AEVION Bank Wealth Constellation",
    description: "Visual map of every income stream and goal.",
    type: "article",
    siteName: "AEVION",
  },
  twitter: { card: "summary_large_image", title: "AEVION Bank Wealth Constellation", description: "Every stream, one map." },
  robots: { index: true, follow: true },
  alternates: { canonical: "/bank/constellation" },
};

export default function ConstellationLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
