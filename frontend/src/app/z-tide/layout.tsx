import type { ReactNode } from "react";
import type { Metadata } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://aevion.app";

export const metadata: Metadata = {
  title: "Z-Tide — Energy & Emotion Currency · AEVION",
  description:
    "Research-проект: концептуальная валюта, привязанная к энергозатратам и социальному вкладу. Параллельный экспериментальный слой к AEV.",
  alternates: { canonical: `${SITE}/z-tide` },
  openGraph: {
    type: "website",
    url: `${SITE}/z-tide`,
    title: "Z-Tide — Energy & Emotion Currency",
    description: "Energy-anchored experimental currency · QSign-audited · parallel to AEV.",
    siteName: "AEVION",
  },
  robots: { index: true, follow: true },
};

export default function ZTideLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
