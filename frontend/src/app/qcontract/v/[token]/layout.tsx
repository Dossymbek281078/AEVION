import type { ReactNode } from "react";
import type { Metadata } from "next";

// Public document view — DO NOT INDEX. The URL contains the access token,
// indexing would let crawlers fetch the document and burn a read.
export const metadata: Metadata = {
  title: "Document · QContract",
  description: "Saved-by-link confidential document. Read once, expires automatically.",
  robots: { index: false, follow: false, nocache: true },
};

export default function ViewLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
