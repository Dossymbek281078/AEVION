import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AEVION — Investor Overview",
  description:
    "Trust infrastructure for the AI content era. Post-quantum IP protection + B2B hiring + embedded payments. Seed $5M.",
};

export default function InvestorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
