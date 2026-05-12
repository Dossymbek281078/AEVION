import type { ReactNode } from "react";
import type { Metadata } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://aevion.app";

export const metadata: Metadata = {
  title: "QGood — Psychology & Mental Health · AEVION",
  description:
    "AI-сопровождение психологического благополучия: разговорный AI, офлайн-режим, link с HealthAI скринером (PHQ-9 / GAD-7), эскалация к живому специалисту.",
  alternates: { canonical: `${SITE}/qgood` },
  openGraph: {
    type: "website",
    url: `${SITE}/qgood`,
    title: "QGood — Psychology & Mental Health",
    description: "AI mental-health companion. Offline mode, clinical-grade scenarios, live-specialist escalation.",
    siteName: "AEVION",
  },
  robots: { index: true, follow: true },
};

export default function QGoodLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "AEVION QGood",
            applicationCategory: "HealthApplication",
            operatingSystem: "Web",
            description: "AI mental-health companion with clinical-grade scenarios, offline mode, HealthAI PHQ-9/GAD-7 link, and live-specialist escalation.",
            url: `${SITE}/qgood`,
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
            featureList: [
              "Clinical-grade conversational AI",
              "Offline private mode",
              "HealthAI screener integration",
              "Risk-based live-specialist escalation",
            ],
            publisher: { "@type": "Organization", name: "AEVION", url: SITE },
          }),
        }}
      />
      {children}
    </>
  );
}
