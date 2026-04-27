import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Wallet Card — AEVION Bank",
  description: "Your AEVION Bank card — virtual representation of your wallet identity, Trust tier, and balance. Tap to flip, print to share.",
  openGraph: {
    title: "AEVION Wallet Card",
    description: "A bank card backed by reputation, not a credit bureau.",
    type: "website",
    siteName: "AEVION",
  },
  robots: { index: true, follow: true },
  alternates: { canonical: "/bank/card" },
};

export default function CardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
