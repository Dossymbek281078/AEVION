import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AEVION — Innovation Partnership Brief (Print)",
  description: "Print-optimised partnership brief. $10M returnable advance · 51/49 revenue · Chief Idea Officer · not a buyout.",
  robots: { index: false, follow: false },
};

export default function PartnerPrintLayout({ children }: { children: React.ReactNode }) {
  return children;
}
