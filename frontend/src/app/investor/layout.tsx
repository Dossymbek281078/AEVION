import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AEVION — Investor Overview",
  description:
    "Trust infrastructure for the AI content era. Ed25519-signed IP protection + B2B hiring + embedded payments. Partnership, not a buyout — $10M returnable advance + 51/49 revenue.",
};

export default function InvestorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
