import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Income feed — AEVION Bank",
  description:
    "Unified chronological view of every AEC inflow: top-ups, P2P transfers in, QRight royalties, CyberChess prizes, Planet certifications.",
  robots: { index: false, follow: false },
};

export default function IncomeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
