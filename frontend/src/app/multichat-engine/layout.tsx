import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Multichat Engine · parallel AI agents over QCoreAI",
  description:
    "Run 6 specialised AI agents in parallel — General, Code, Finance, IP/Legal, Compliance, Translator — backed by Claude/GPT/Gemini/DeepSeek/Grok. Persistent local sessions.",
  openGraph: {
    title: "AEVION Multichat — agent grid for serious work",
    description: "Parallel agents per domain. White-label B2B foundation.",
    type: "website",
    siteName: "AEVION",
  },
  twitter: { card: "summary_large_image", title: "AEVION Multichat", description: "Parallel AI agents on one screen." },
  alternates: { canonical: "/multichat-engine" },
};

export default function MultichatLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
