import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Recurring Payments — AEVION Bank",
  description: "Manage scheduled transfers — subscriptions, salaries, and recurring payments. Set frequency, track next-due dates, pause or cancel any time.",
  openGraph: {
    title: "AEVION Bank — Recurring Payments",
    description: "Scheduled transfers on autopilot. Daily, weekly, bi-weekly, or monthly — paused or active in one tap.",
    type: "article",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Bank — Recurring Payments",
    description: "Scheduled transfers on autopilot.",
  },
  robots: { index: true, follow: true },
  alternates: { canonical: "/bank/recurring" },
};

export default function RecurringLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
