import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AEVION Bank — wallet · royalties · trust-gated credit",
  description:
    "Unified wallet for AEC credits, automatic royalties from IP usage, savings goals, recurring payments, salary advance gated by Trust Score. Multilingual EN/RU/KZ.",
  openGraph: {
    title: "AEVION Bank — economic root of the trust ecosystem",
    description: "18 shipping features + 5 Autopilot rules. Live MVP today.",
    type: "website",
    siteName: "AEVION",
  },
  twitter: { card: "summary_large_image", title: "AEVION Bank", description: "Wallet, royalties and Trust-Score-gated credit." },
  alternates: { canonical: "/bank" },
};

export default function BankLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
