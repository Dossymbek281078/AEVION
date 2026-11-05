import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "QAI — Universal AI Assistant",
  description:
    "AEVION AI assistant: personas and saved sessions across several AI providers. Included in the AEVION Planet plan (any term); sign in with the payment email.",
  openGraph: {
    title: "QAI — Universal AI Assistant",
    description: "Multi-provider AI chat. Claude, GPT-4o, Gemini in one place.",
    siteName: "AEVION",
  },
};

export default function QAILayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
