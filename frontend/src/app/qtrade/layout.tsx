import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "AEVION QTrade — биржа",
  description:
    "AEVION QTrade — современная биржа для торговли криптоактивами. Прямой доступ к рынку, быстрые ордера, прозрачная аналитика.",
  manifest: "/manifest-qtrade.json",
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
