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
  return <>{children}</>;
}
