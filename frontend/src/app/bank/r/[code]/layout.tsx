import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AEVION Bank — You're invited",
  description: "Your friend invited you to AEVION. Sign up to claim a Starter bonus on your first top-up.",
  openGraph: {
    title: "You're invited to AEVION",
    description: "Trust-graph wallet · royalties · social payments. Sign up via this link to get a starter bonus.",
    type: "website",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "You're invited to AEVION",
    description: "Trust-graph wallet with social payments + creator royalties.",
  },
  robots: { index: false, follow: false },
};

export default function ReferralLandingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
