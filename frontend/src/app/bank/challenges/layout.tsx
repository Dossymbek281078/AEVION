import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Challenges — AEVION Bank",
  description: "No-spend streaks and savings challenges to nudge healthy money habits.",
  openGraph: {
    title: "AEVION Bank Challenges",
    description: "No-spend streaks and savings challenges.",
    type: "article",
    siteName: "AEVION",
  },
  twitter: { card: "summary_large_image", title: "AEVION Bank Challenges", description: "No-spend streaks." },
  robots: { index: true, follow: true },
  alternates: { canonical: "/bank/challenges" },
};

export default function ChallengesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
