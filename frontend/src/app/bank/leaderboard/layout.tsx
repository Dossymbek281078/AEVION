import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AEVION Bank — Leaderboard",
  description: "Top creators, chess champions, and referrers across the AEVION trust network.",
  robots: { index: true, follow: true },
};

export default function LeaderboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
