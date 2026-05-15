import type { Metadata } from "next";
import { BreadcrumbsJsonLd } from "../_components/BreadcrumbsJsonLd";

export const metadata: Metadata = {
  title: "Achievements — AEVION Bank",
  description: "Unlocked badges and progress trackers across the AEVION Bank wallet.",
  openGraph: {
    title: "AEVION Bank Achievements",
    description: "Badges, milestones, and progress.",
    type: "article",
    siteName: "AEVION",
  },
  twitter: { card: "summary_large_image", title: "AEVION Bank Achievements", description: "Badges and progress." },
  robots: { index: true, follow: true },
  alternates: { canonical: "/bank/achievements" },
};

export default function AchievementsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BreadcrumbsJsonLd path="/bank/achievements" name="Achievements" />
      {children}
    </>
  );
}
