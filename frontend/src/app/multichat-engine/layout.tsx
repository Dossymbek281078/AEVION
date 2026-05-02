import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Multichat Engine · parallel AI agents over QCoreAI",
  description:
    "Run 6 specialised AI agents in parallel — General, Code, Finance, IP/Legal, Compliance, Translator — across Claude / GPT / Gemini / DeepSeek / Grok. Cross-agent @mention handoff, broadcast, custom prompts, MD/JSON export. Live.",
  keywords: [
    "AI agents",
    "parallel chat",
    "multi-agent",
    "Claude",
    "GPT",
    "Gemini",
    "DeepSeek",
    "Grok",
    "AEVION",
    "QCoreAI",
    "AI orchestration",
  ],
  openGraph: {
    title: "AEVION Multichat — parallel AI agents in one window",
    description:
      "6 specialised agents · 5 LLM providers · cross-agent @mention handoff · broadcast · custom prompts · MD/JSON export. Live in production.",
    type: "website",
    siteName: "AEVION",
    url: "/multichat-engine",
    locale: "en",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Multichat — parallel AI agents",
    description: "6 agents in one window. @mention handoff. Broadcast. Live.",
  },
  alternates: { canonical: "/multichat-engine" },
};

export default function MultichatLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
