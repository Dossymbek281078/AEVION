import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Time travel — AEVION Bank",
  description: "Replay wallet state at any month — see what your balance, royalties, and recurring rules looked like at any point.",
  openGraph: {
    title: "AEVION Bank Time Travel",
    description: "Replay your wallet at any past month.",
    type: "article",
    siteName: "AEVION",
  },
  twitter: { card: "summary_large_image", title: "AEVION Bank Time Travel", description: "Replay any past month." },
  robots: { index: true, follow: true },
  alternates: { canonical: "/bank/timetravel" },
};

export default function TimetravelLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
