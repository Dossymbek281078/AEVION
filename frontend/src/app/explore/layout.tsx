import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Explore the AEVION planet — 25+ tools you own",
  description:
    "AEVION is a working planet of AI, ownership and money on a single trust core. Register what you create, prove it cryptographically, get paid, and run business, health and life from one place. Start with QVenture.",
  openGraph: {
    title: "Explore the AEVION planet",
    description:
      "A working world of AI, ownership and money on one trust core. Start with QVenture; the rest of the planet opens from there.",
    type: "website",
  },
};

export default function ExploreLayout({ children }: { children: ReactNode }) {
  return children;
}
