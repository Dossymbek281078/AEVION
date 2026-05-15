import type { ReactNode } from "react";
import type { Metadata } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://aevion.app";

export const metadata: Metadata = {
  title: "Voice of Earth — Multi-language Music · AEVION",
  description:
    "Международный музыкальный проект на разных языках с автоматической фиксацией авторства через QRight + QSign и публичным распределением роялти.",
  alternates: { canonical: `${SITE}/voice-of-earth` },
  openGraph: {
    type: "website",
    url: `${SITE}/voice-of-earth`,
    title: "Voice of Earth — Multi-language Music",
    description: "Multi-language songs · on-chain authorship · open royalty splits.",
    siteName: "AEVION",
  },
  robots: { index: true, follow: true },
};

export default function VoELayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
