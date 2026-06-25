import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AEVION — 90-day Pilot · Trust / Dev / Financial",
  description:
    "Three pre-priced 90-day pilots on Planet AEVION. Trust ($50K), Dev ($75K), Financial ($100K). Pilot fee creditable against future acquisition.",
  openGraph: {
    title: "AEVION 90-day Pilot — Trust / Dev / Financial",
    description: "$50K · $75K · $100K. Pilot fee credited 100% against acquisition price.",
    type: "website",
  },
};

export default function PilotLayout({ children }: { children: React.ReactNode }) {
  return children;
}
