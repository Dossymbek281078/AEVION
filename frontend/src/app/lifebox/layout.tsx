import type { ReactNode } from "react";
import type { Metadata } from "next";
import { ModuleMaturity } from "@/components/ModuleMaturity";

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://aevion.app";

export const metadata: Metadata = {
  title: "LifeBox — Digital Safe for Future Self · AEVION",
  description:
    "100-летнее цифровое хранилище: документы, знания, ценности. Inheritance через QShield Shamir-разбиение, аудит каждого доступа через QSign.",
  alternates: { canonical: `${SITE}/lifebox` },
  openGraph: {
    type: "website",
    url: `${SITE}/lifebox`,
    title: "LifeBox — Digital Safe for Future Self",
    description: "100-year storage · Shamir inheritance · QSign access audit · trigger-based unlock.",
    siteName: "AEVION",
    images: [{ url: `${SITE}/lifebox/opengraph-image`, width: 1200, height: 630 }],
  },
  robots: { index: true, follow: true },
};

export default function LifeBoxLayout({ children }: { children: ReactNode }) {
  return <><ModuleMaturity id="lifebox" />
      {children}</>;
}
