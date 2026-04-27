import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Receipt — AEVION Bank",
  description: "Printable AEVION Bank receipt with QSign signature row and verification QR.",
  robots: { index: false, follow: false },
};

export default function ReceiptLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
