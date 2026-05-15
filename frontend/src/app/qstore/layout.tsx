import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "QStore — Digital Marketplace | AEVION",
  description:
    "Buy and sell digital products: templates, presets, code, music, design assets. AEVION digital marketplace.",
  openGraph: {
    title: "QStore — Digital Marketplace",
    description: "Buy and sell templates, code, music, design assets and more.",
    siteName: "AEVION",
  },
};

export default function QStoreLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
