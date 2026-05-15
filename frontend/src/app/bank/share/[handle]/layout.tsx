import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AEVION Bank — Public profile",
  description: "Public AEVION presence — Trust Score, tier, and a Send-AEC quick action.",
  openGraph: {
    title: "AEVION public profile",
    description: "Trust Score · tier · send AEC in one tap.",
    type: "profile",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION profile",
    description: "Trust-graph identity with quick-pay.",
  },
  robots: { index: true, follow: true },
};

export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
