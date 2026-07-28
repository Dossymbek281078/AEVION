import type { ReactNode } from "react";
import type { Metadata } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://aevion.app";

export const metadata: Metadata = {
  title: "AEVION против аналогов — где мы сильнее, где слабее",
  description:
    "Честное сравнение модулей AEVION с публичными аналогами: CyberChess и Lichess, QSign и DocuSign, платёжный API и Stripe, QBuild и Lovable, QReal и Higgsfield. С колонкой «где мы слабее» и ссылками на источники.",
  alternates: { canonical: `${SITE}/compare` },
  openGraph: {
    type: "website",
    url: `${SITE}/compare`,
    title: "AEVION против аналогов",
    description: "Сравнение по фактам: что измерено, где мы слабее и чем это проверено.",
    siteName: "AEVION",
  },
  robots: { index: true, follow: true },
};

export default function CompareLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
