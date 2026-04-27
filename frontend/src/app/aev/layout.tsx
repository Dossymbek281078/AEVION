import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "AEV — нативный токен AEVION",
  description:
    "AEV эмитится не по принципу traditional coins. Три движка: Proof-of-Play, Proof-of-Useful-Compute, Proof-of-Stewardship. Хард-кап 21M.",
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
};

export default function AevLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
