import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AEVION — Innovation Partnership · $100M / 70% / CIO",
  description:
    "Strategic partnership opportunity. $170M total: $110M secondary (founder nets $100M), $60M primary. Investor 70%, founder 30% + Chief Innovation Officer. DIFC structure.",
  openGraph: {
    title: "AEVION Innovation Partnership",
    description: "70% equity + team + $170M. Founder stays as CIO generating next wave of ideas.",
    type: "website",
  },
};

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
