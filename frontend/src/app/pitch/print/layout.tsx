import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AEVION Pitch · Print version",
  description:
    "Print-optimised version of the AEVION investor pitch. The canonical, indexable URL is /pitch — this page is for export to PDF or hard copy only.",
  alternates: { canonical: "/pitch" },
  robots: { index: false, follow: true },
};

export default function PitchPrintLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
