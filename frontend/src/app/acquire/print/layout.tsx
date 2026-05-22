import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AEVION — Acquisition Brief (Print)",
  description: "Print-optimised version of the acquisition brief.",
  robots: { index: false, follow: false },
};

export default function AcquirePrintLayout({ children }: { children: React.ReactNode }) {
  return children;
}
