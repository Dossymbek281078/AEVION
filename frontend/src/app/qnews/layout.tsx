import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "QNews — AI News Aggregator | AEVION",
  description: "Stay informed with AI-powered news summaries across tech, crypto, AI, business, science, and world topics.",
  openGraph: {
    title: "QNews — AI News Aggregator",
    description: "Curated news with AI summaries across tech, crypto, AI, and more.",
    siteName: "AEVION",
  },
};

export default function QNewsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
