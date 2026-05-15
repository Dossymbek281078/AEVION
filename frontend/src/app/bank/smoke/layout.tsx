import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bank smoke runner — AEVION",
  description: "Live end-to-end smoke test for the AEVION Bank backend wiring: auth, accounts, topup, transfer, sign, verify.",
  robots: { index: false, follow: false },
};

export default function SmokeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
