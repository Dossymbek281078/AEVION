import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AEVION Agent — one window, text or action",
  description:
    "One window: ask a question or ask for a thing — image, voice, payment link, email — and it runs here, without opening another tab. Orchestrates existing AEVION capabilities, incl. offline/local models.",
};

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
