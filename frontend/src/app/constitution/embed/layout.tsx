import type { Metadata } from "next";
import type { ReactNode } from "react";

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://aevion.app";

export const metadata: Metadata = {
  title: "Constitution Embed Widget · AEVION",
  description:
    "Iframe-friendly Constitution radar widget. Drop on any site to show a governance fingerprint.",
  alternates: { canonical: `${SITE}/constitution/embed` },
  // Allow framing from any origin (embed widget by design)
  other: {
    "X-Frame-Options": "ALLOWALL",
  },
  robots: { index: false, follow: false },
};

export default function EmbedLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
