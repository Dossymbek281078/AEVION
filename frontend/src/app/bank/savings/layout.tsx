import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Savings — AEVION Bank",
  description: "Combined view of every saving product in AEVION Bank: Goals, Round-Up Stash, AEC Vault. One dashboard, three layered ways to put money aside.",
  openGraph: {
    title: "AEVION Bank Savings",
    description: "Three saving products, one dashboard. Goals · Round-Up · Vault.",
    type: "article",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Bank Savings",
    description: "Goals · Round-Up · Vault — all in one view.",
  },
  robots: { index: true, follow: true },
  alternates: { canonical: "/bank/savings" },
};

export default function SavingsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
