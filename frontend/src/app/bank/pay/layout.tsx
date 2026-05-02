import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AEVION Bank — Scan to pay",
  description: "Generate a scan-to-pay QR code for in-person AEC payments. Recipients open in their AEVION wallet to confirm.",
  robots: { index: false, follow: false },
};

export default function PayLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
