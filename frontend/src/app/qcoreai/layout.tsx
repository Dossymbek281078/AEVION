import type { Metadata } from "next";
import QcoreQuotaMeter from "./QcoreQuotaMeter";
import { serverLang } from "@/lib/serverLang";
import { ServerLangProvider } from "@/lib/serverLangContext";

// Язык первого кадра платной стены (PaywallScreen) выбирает сервер: кука →
// Accept-Language → ru (lib/serverLangContext.tsx, 30.10.2026).
export const dynamic = "force-dynamic";

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

export default async function QCoreAILayout({ children }: { children: React.ReactNode }) {
  const lang = await serverLang("ru");
  return (
    <ServerLangProvider lang={lang}>
      <QcoreQuotaMeter />
      {children}
    </ServerLangProvider>
  );
}
