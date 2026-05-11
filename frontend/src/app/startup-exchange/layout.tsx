import type { ReactNode } from "react";
import type { Metadata } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://aevion.app";

export const metadata: Metadata = {
  title: "Startup Exchange — Protected Ideas Marketplace · AEVION",
  description:
    "Биржа стартапов с авто-защитой авторства через QRight + QSign, Smart-NDA на QContract, эскроу через QPayNet и публичной репутацией инвесторов.",
  alternates: { canonical: `${SITE}/startup-exchange` },
  openGraph: {
    type: "website",
    url: `${SITE}/startup-exchange`,
    title: "Startup Exchange — Protected Ideas Marketplace",
    description: "Pitches with QRight authorship · Smart-NDA · QPayNet escrow · public investor reputation.",
    siteName: "AEVION",
  },
  robots: { index: true, follow: true },
};

export default function StartupXLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
