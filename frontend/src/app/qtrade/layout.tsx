import type { Metadata, Viewport } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://aevion.io";

export const metadata: Metadata = {
  title: "AEVION QTrade — биржа",
  description:
    "AEVION QTrade — pro-уровень trading terminal: live markets, OHLC chart с TF picker, SL/TP brackets, price alerts, DCA + Grid bots, backtester, trade journal, risk dashboard, position sizing.",
  metadataBase: new URL(SITE),
  manifest: "/manifest-qtrade.json",
  alternates: { canonical: `${SITE}/qtrade` },
  openGraph: {
    type: "website",
    url: `${SITE}/qtrade`,
    title: "AEVION QTrade — pro trading terminal",
    description: "Live markets · OHLC · DCA + Grid bots · backtester · trade journal · risk dashboard · price alerts",
    siteName: "AEVION",
    images: [{ url: "/qtrade-icon-512.svg", width: 512, height: 512, alt: "QTrade" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION QTrade — pro trading terminal",
    description: "Live markets · OHLC · DCA + Grid bots · backtester · trade journal · risk dashboard",
    images: ["/qtrade-icon-512.svg"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "QTrade",
  },
  icons: {
    icon: [
      { url: "/qtrade-icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
      { url: "/qtrade-icon-512.svg", sizes: "512x512", type: "image/svg+xml" },
    ],
    apple: [{ url: "/qtrade-icon-192.svg" }],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function QTradeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
