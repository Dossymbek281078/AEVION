import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AEVION — Innovation Partnership Brief (Print)",
  description: "Print-optimised partnership brief. $170M / 70% / CIO model.",
  robots: { index: false, follow: false },
};

export default function PartnerPrintLayout({ children }: { children: React.ReactNode }) {
  return children;
}
