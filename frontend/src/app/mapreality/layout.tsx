import type { ReactNode } from "react";
import type { Metadata } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://aevion.app";

export const metadata: Metadata = {
  title: "MapReality — Map of Real Needs · AEVION",
  description:
    "Карта реальных событий и потребностей: сигналы граждан с гео-привязкой, QSign-аудит источников, open API для сторонних визуализаций.",
  alternates: { canonical: `${SITE}/mapreality` },
  openGraph: {
    type: "website",
    url: `${SITE}/mapreality`,
    title: "MapReality — Map of Real Needs",
    description: "Citizen-sourced geo signals · QSign audit · open API · no editorial spin.",
    siteName: "AEVION",
  },
  robots: { index: true, follow: true },
};

export default function MapRealityLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
