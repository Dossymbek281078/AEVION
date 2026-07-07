import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AEVION · Investor Pitch — the AEVION partnership offer",
  description:
    "37 modules deployed to production (~a dozen feature-complete) across IP enforcement, creator economy and digital payments. Pre-revenue. One identity, one pipeline, one Trust Graph.",
  keywords: [
    "AEVION",
    "investor pitch",
    "IP infrastructure",
    "trust graph",
    "creator economy",
    "digital identity",
    "authorship & prior-art bureau",
    "quantum-resistant",
    "Trust OS",
  ],
  openGraph: {
    title: "AEVION — Trust operating system for digital creation",
    description:
      "37 modules deployed (~a dozen feature-complete) across IP, signatures, bureau, compliance, AI, banking. Pre-revenue; large category TAM across IP, creators and payments.",
    type: "website",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION — trust infrastructure partnership",
    description:
      "37 modules deployed · ~a dozen feature-complete · one Trust Graph · large category TAM (IP, creators, payments).",
  },
  alternates: { canonical: "/pitch" },
};

export default function PitchLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
