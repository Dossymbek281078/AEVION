import type { Metadata, Viewport } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://aevion.io";

export const metadata: Metadata = {
  title: "AEV — нативный токен AEVION",
  description:
    "AEV эмитится не по принципу traditional coins. 8 движков: Play, Compute, Stewardship, Curation, Mentorship, Streak, Network, Insight. Хард-кап 21M, marketplace + 19 quests + tokenomics page.",
  metadataBase: new URL(SITE),
  manifest: "/manifest-aev.json",
  alternates: { canonical: `${SITE}/aev` },
  openGraph: {
    type: "website",
    url: `${SITE}/aev`,
    title: "AEV — нативный токен AEVION",
    description: "8 движков эмиссии · 21M cap · marketplace · 19 quests · tokenomics page. Mining через действия в продуктах AEVION.",
    siteName: "AEVION",
    images: [{ url: "/aev-icon-512.svg", width: 512, height: 512, alt: "AEV token" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AEV — нативный токен AEVION",
    description: "8 движков эмиссии · 21M cap · marketplace · quests · tokenomics page",
    images: ["/aev-icon-512.svg"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "AEV",
  },
  icons: {
    icon: [
      { url: "/aev-icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
      { url: "/aev-icon-512.svg", sizes: "512x512", type: "image/svg+xml" },
    ],
    apple: [{ url: "/aev-icon-192.svg" }],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#1e1b4b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function AevLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
