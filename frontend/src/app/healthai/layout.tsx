import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "HealthAI — Personal AI Doctor · AEVION",
  description:
    "Personal AI Doctor: rule-based symptom triage, daily wellness log, BMI, trends, risk indicators, PHQ-9 & GAD-7 screeners, weekly plan, cycle tracker, family profiles. RU/EN.",
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
