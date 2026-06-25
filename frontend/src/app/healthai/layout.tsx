import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "HealthAI — Personal AI Doctor · AEVION",
  description:
    "Personal AI Doctor: rule-based symptom triage, daily wellness log, BMI, trends, risk indicators, PHQ-9 & GAD-7 screeners, weekly plan, cycle tracker, family profiles. RU/EN.",
  keywords: ["HealthAI", "AEVION", "AI doctor", "symptom checker", "wellness", "PHQ-9", "personal health"],
  openGraph: {
    title: "HealthAI — Personal AI Doctor · AEVION",
    description:
      "Personal AI Doctor: symptom triage, wellness log, BMI, PHQ-9/GAD-7 screeners, weekly plan, cycle tracker, family profiles. RU/EN.",
    type: "website",
    siteName: "AEVION HealthAI",
    url: "/healthai",
  },
  twitter: {
    card: "summary_large_image",
    title: "HealthAI — AI Doctor · AEVION",
    description: "Symptom triage, wellness log, PHQ-9/GAD-7, weekly plan. Free, private, no diagnosis.",
  },
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
