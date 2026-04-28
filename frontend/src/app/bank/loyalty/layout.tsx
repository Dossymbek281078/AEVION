import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Loyalty vault — AEVION Bank",
  description: "Track external loyalty programs — points, miles, vouchers — with expiry alerts and category tagging.",
  openGraph: {
    title: "AEVION Bank Loyalty Vault",
    description: "External loyalty programs with expiry alerts.",
    type: "article",
    siteName: "AEVION",
  },
  twitter: { card: "summary_large_image", title: "AEVION Bank Loyalty Vault", description: "Loyalty programs, organised." },
  robots: { index: true, follow: true },
  alternates: { canonical: "/bank/loyalty" },
};

export default function LoyaltyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
