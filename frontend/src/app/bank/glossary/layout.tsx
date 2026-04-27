import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Glossary — AEVION Bank",
  description: "Dictionary of every AEVION Bank term — AEC, Trust Score, Vault, Round-Up, QSign, Salary Advance, Circles, and more. One short paragraph each.",
  openGraph: {
    title: "AEVION Bank Glossary",
    description: "Every term in the wallet, defined in one paragraph each.",
    type: "article",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Bank Glossary",
    description: "Every term, defined.",
  },
  robots: { index: true, follow: true },
};

export default function GlossaryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
