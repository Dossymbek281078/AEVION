import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "QAI — Universal AI Assistant | AEVION",
  description:
    "Chat with the AEVION AI assistant. Multi-provider: Claude, GPT-4o, Gemini. No account required.",
  openGraph: {
    title: "QAI — Universal AI Assistant",
    description: "Multi-provider AI chat. Claude, GPT-4o, Gemini in one place.",
    siteName: "AEVION",
  },
};

export default function QAILayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
