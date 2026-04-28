import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Billing calendar — AEVION Bank",
  description: "30-day billing horizon for your AEVION Bank wallet — heat-mapped view of upcoming recurring charges with daily totals and counts.",
  openGraph: {
    title: "AEVION Bank Billing Calendar",
    description: "30 days of upcoming recurring charges, heat-mapped at a glance.",
    type: "article",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Bank Billing Calendar",
    description: "Upcoming charges, heat-mapped.",
  },
  robots: { index: true, follow: true },
  alternates: { canonical: "/bank/calendar" },
};

export default function CalendarLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
