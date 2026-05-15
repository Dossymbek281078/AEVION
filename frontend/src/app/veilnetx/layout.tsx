import type { ReactNode } from "react";
import type { Metadata } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://aevion.app";

export const metadata: Metadata = {
  title: "VeilNetX — Privacy Proxy + Tor-routing · AEVION",
  description:
    "Privacy-first proxy network: Tor-routed traffic, end-to-end encryption, anti-fingerprinting. Без логов, без email, без KYC. Open-source клиенты.",
  alternates: { canonical: `${SITE}/veilnetx` },
  openGraph: {
    type: "website",
    url: `${SITE}/veilnetx`,
    title: "VeilNetX — Privacy Proxy + Tor-routing",
    description: "Tor-routed traffic · no logs · no email · no KYC · open-source.",
    siteName: "AEVION",
    images: [{ url: `${SITE}/veilnetx/opengraph-image`, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "VeilNetX · Privacy Proxy",
    description: "Tor-routed. No logs. No KYC.",
  },
  robots: { index: true, follow: true },
};

export default function VeilNetXLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
