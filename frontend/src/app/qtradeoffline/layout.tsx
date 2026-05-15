import type { ReactNode } from "react";
import type { Metadata } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://aevion.app";

export const metadata: Metadata = {
  title: "QTradeOffline — Offline-first AEV transfers · AEVION",
  description:
    "P2P AEV transfers without internet: ECDSA P-256 signed offline, claim later, batch-sync to backend. For low-bandwidth, embargoed, and conflict zones.",
  alternates: { canonical: `${SITE}/qtradeoffline` },
  openGraph: {
    type: "website",
    url: `${SITE}/qtradeoffline`,
    title: "QTradeOffline — Offline-first AEV transfers",
    description:
      "Sign AEV transfers offline (ECDSA P-256), claim later. Works in low-bandwidth and embargoed environments.",
    siteName: "AEVION",
    images: [{ url: `${SITE}/qtradeoffline/opengraph-image`, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "QTradeOffline · Offline-first AEV",
    description: "Sign offline, sync later. ECDSA P-256.",
  },
  robots: { index: true, follow: true },
};

export default function QTradeOfflineLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
