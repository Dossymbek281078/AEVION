import type { Metadata, Viewport } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://aevion.app";

export const metadata: Metadata = {
  title: "HealthAI — Personal AI Doctor · AEVION",
  description:
    "Personal AI Doctor: rule-based symptom triage, daily wellness log, BMI, trends, risk indicators, PHQ-9 & GAD-7 screeners, weekly plan, cycle tracker, family profiles. RU/EN.",
  alternates: { canonical: `${SITE}/healthai` },
  openGraph: {
    type: "website",
    url: `${SITE}/healthai`,
    title: "HealthAI — Personal AI Doctor",
    description:
      "Symptom triage · daily wellness log · BMI/trends · PHQ-9/GAD-7 · weekly plan · cycle tracker. NOT medical advice.",
    siteName: "AEVION",
    images: [{ url: `${SITE}/healthai/opengraph-image`, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "HealthAI · Personal AI Doctor",
    description: "Triage + tracking + screeners. Not medical advice — see a clinician.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#070b14",
  colorScheme: "dark",
};

export default function HealthAILayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
