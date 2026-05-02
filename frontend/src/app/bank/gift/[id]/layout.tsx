import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AEVION Bank — Gift",
  description: "A gift in AEC sent to you through AEVION Bank.",
  openGraph: {
    title: "You've got a gift on AEVION",
    description: "Open the card to see your AEC gift, message and unlock time.",
    type: "website",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "You've got a gift on AEVION",
    description: "AEC gift card with a personal message.",
  },
  robots: { index: false, follow: false },
};

export default function GiftLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
