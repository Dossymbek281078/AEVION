import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "AEV — нативный токен AEVION",
  description:
    "AEV эмитится не по принципу traditional coins. Три движка: Proof-of-Play, Proof-of-Useful-Compute, Proof-of-Stewardship. Хард-кап 21M.",
  manifest: "/manifest-aev.json",
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
