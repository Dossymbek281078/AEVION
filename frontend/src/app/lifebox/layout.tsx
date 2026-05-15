import type { ReactNode } from "react";
import type { Metadata } from "next";

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
  },
  robots: { index: true, follow: true },
};

export default function LifeBoxLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
