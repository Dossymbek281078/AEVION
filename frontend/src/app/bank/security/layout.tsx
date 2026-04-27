import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Security — AEVION Bank",
  description: "How AEVION Bank protects your money: biometric guards, Ed25519 signatures via QSign, on-device storage, anomaly detection, full data export. Defence in depth, not paperwork.",
  openGraph: {
    title: "AEVION Bank Security",
    description: "Cryptographic guarantees, on-device storage, biometric guards.",
    type: "article",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Bank Security",
    description: "Defence in depth, not paperwork.",
  },
  robots: { index: true, follow: true },
};

export default function SecurityLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
