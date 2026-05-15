import type { ReactNode } from "react";
import type { Metadata } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://aevion.app";

export const metadata: Metadata = {
  title: "ShadowNet — Alternative Private Network · AEVION",
  description:
    "Альтернативная приватная сеть поверх VeilNetX: анонимный форум, mesh-обмен, off-grid коммуникации, end-to-end шифрование без метаданных.",
  alternates: { canonical: `${SITE}/shadownet` },
  openGraph: {
    type: "website",
    url: `${SITE}/shadownet`,
    title: "ShadowNet — Alternative Private Network",
    description: "Private network over VeilNetX · mesh fallback · E2E without metadata · open-source clients.",
    siteName: "AEVION",
  },
  robots: { index: true, follow: true },
};

export default function ShadowNetLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
