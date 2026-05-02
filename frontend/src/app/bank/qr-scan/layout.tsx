import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AEVION Bank — Scan QR",
  description: "Camera scanner for AEVION pay-links. Decodes /bank/pay QRs and routes you into the wallet's send flow.",
  robots: { index: false, follow: false },
};

export default function QrScanLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
