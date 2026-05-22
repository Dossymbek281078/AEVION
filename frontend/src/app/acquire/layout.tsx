import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AEVION — Acquisition Brief · $1B net",
  description:
    "Planet AEVION — financial layer + IP/trust layer + dev agent-layer + consumer proof, under one settlement unit (AEV). Acquisition floor: $1B net + Senior Advisor seat.",
  openGraph: {
    title: "Planet AEVION — Acquisition Brief",
    description:
      "30+ modules in production. AEV in circulation. Constitution v1 attested. Acquisition floor: $1B net.",
    type: "website",
  },
  robots: { index: false, follow: false },
};

export default function AcquireLayout({ children }: { children: React.ReactNode }) {
  return children;
}
