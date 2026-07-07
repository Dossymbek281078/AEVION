import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AEVION · Investor Pitch — the AEVION partnership offer",
  description:
    "37-node trust ecosystem (12 live MVPs) selling into $340B addressable market across IP enforcement, creator economy and digital payments. One identity, one pipeline, one Trust Graph.",
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
      "12 live MVPs across IP, signatures, bureau, compliance, AI, banking, chess. $340B TAM, $2B+ modelled ARR by year 5.",
    type: "website",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION — trust infrastructure partnership",
    description:
      "37 nodes · 12 live MVPs · one Trust Graph · $340B addressable market across three deep buckets.",
  },
  alternates: { canonical: "/pitch" },
};

export default function PitchLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
