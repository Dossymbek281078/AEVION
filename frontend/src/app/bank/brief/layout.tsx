import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Weekly brief — AEVION Bank",
  description: "AI-style weekly digest of your AEVION Bank wallet — top movers, anomalies, milestones.",
  openGraph: {
    title: "AEVION Bank Weekly Brief",
    description: "AI-style weekly wallet digest.",
    type: "article",
    siteName: "AEVION",
  },
  twitter: { card: "summary_large_image", title: "AEVION Bank Weekly Brief", description: "Weekly wallet digest." },
  robots: { index: true, follow: true },
  alternates: { canonical: "/bank/brief" },
};

export default function BriefLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
