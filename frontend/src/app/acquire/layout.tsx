import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AEVION — Partnership Brief · planet on Claude",
  description:
    "Planet AEVION — financial layer + IP/trust layer + dev agent-layer + consumer proof, under one settlement unit (AEV). One offer: a $10M repayable advance + a 51/49 revenue partnership.",
  openGraph: {
    title: "Planet AEVION — Partnership Brief",
    description:
      "30+ modules in production. AEV in circulation. Constitution v1 attested. One offer: a $10M repayable advance + a 51/49 revenue partnership.",
    type: "website",
  },
  robots: { index: false, follow: false },
};

export default function AcquireLayout({ children }: { children: React.ReactNode }) {
  return children;
}
