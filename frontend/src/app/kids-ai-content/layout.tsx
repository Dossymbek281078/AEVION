import type { ReactNode } from "react";
import type { Metadata } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://aevion.app";

export const metadata: Metadata = {
  title: "Kids AI Content — Safe Multi-language Learning · AEVION",
  description:
    "Безопасный многоязычный AI-контент для детей: фильтры, родительский dashboard, логопедический модуль, привязка к возрастной шкале.",
  alternates: { canonical: `${SITE}/kids-ai-content` },
  openGraph: {
    type: "website",
    url: `${SITE}/kids-ai-content`,
    title: "Kids AI Content — Safe Multi-language Learning",
    description: "Safe AI for kids · multi-language · speech therapy · age-tiered.",
    siteName: "AEVION",
  },
  robots: { index: true, follow: true },
};

export default function KidsAILayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
