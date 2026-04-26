import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AEVION Awards · Music & Film recognition with AEC payouts",
  description:
    "Submit AI-music or AI-film to the AEVION Awards. Validators on Planet certify originality, the community votes, top-3 receive AEC prizes settled to your AEVION Bank wallet.",
  openGraph: {
    title: "AEVION Awards — recognition tied to revenue",
    description: "QRight register → submit → Planet validate → AEC payout.",
    type: "website",
    siteName: "AEVION",
  },
  twitter: { card: "summary_large_image", title: "AEVION Awards", description: "AI-music & AI-film awards with AEC prizes." },
  alternates: { canonical: "/awards" },
};

export default function AwardsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
