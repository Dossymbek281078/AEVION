import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AEVION · Verify certificate",
  description:
    "Verify an AEVION certificate (QSign / QRight / Bureau / Planet). Public verification of authorship, signature and validator quorum — independent of any user account.",
  openGraph: {
    title: "AEVION — Verify certificate",
    description: "Public verification of AEVION authorship, signature, and validator-quorum certificates.",
    type: "website",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary",
    title: "AEVION verify",
    description: "Public certificate verification.",
  },
  robots: { index: false, follow: true },
};

export default function VerifyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
