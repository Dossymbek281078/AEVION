import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "QNews — Free Tech News Feed",
  description: "Free feed of tech news from Hacker News. Every item links to the original.",
  openGraph: {
    title: "QNews — Free Tech News Feed",
    description: "Free feed of tech news from Hacker News, each item links to the original.",
    siteName: "AEVION",
  },
};

export default function QNewsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
