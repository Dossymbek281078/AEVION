import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "QCoreAI — AEVION Multi-Agent Platform",
    template: "%s | QCoreAI · AEVION",
  },
  description:
    "QCoreAI: multi-agent AI pipeline with Analyst → Writer → Critic, eval harness, batch runs, custom pipelines, prompt optimization, and more.",
  keywords: ["QCoreAI", "AEVION", "multi-agent", "AI pipeline", "LLM orchestration", "eval harness"],
  openGraph: {
    siteName: "AEVION QCoreAI",
    type: "website",
    images: [
      {
        url: "/api/og/qcoreai",
        width: 1200,
        height: 630,
        alt: "QCoreAI — AEVION Multi-Agent Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "QCoreAI — AEVION Multi-Agent Platform",
    description: "Multi-agent AI with Analyst → Writer → Critic, eval harness, batch runs, and more.",
  },
};

export default function QCoreAILayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
