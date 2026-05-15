import type { ReactNode } from "react";
import type { Metadata } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://aevion.app";

export const metadata: Metadata = {
  title: "QFusionAI — Hybrid AI Router · AEVION",
  description:
    "Гибридный AI-движок, объединяющий лучшие LLM (OpenAI, Anthropic, Gemini, DeepSeek, Grok) с автоматическим routing по цене/скорости/качеству. Один API — пять провайдеров.",
  alternates: { canonical: `${SITE}/qfusionai` },
  openGraph: {
    type: "website",
    url: `${SITE}/qfusionai`,
    title: "QFusionAI — Hybrid AI Router",
    description:
      "5 LLM-провайдеров в одном API · автоматический routing по cost/latency/quality · fallback chain · кэш ответов.",
    siteName: "AEVION",
    images: [{ url: `${SITE}/qfusionai/opengraph-image`, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "QFusionAI · Hybrid AI Router",
    description: "5 LLM providers, 1 API. Auto-routing + fallback + cache.",
  },
  robots: { index: true, follow: true },
};

export default function QFusionAILayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
