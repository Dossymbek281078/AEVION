import type { ReactNode } from "react";
import type { Metadata } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://aevion.app";

export const metadata: Metadata = {
  title: "QMaskCard — Disposable Virtual Cards · AEVION",
  description:
    "Одноразовые виртуальные карты для онлайн-покупок. Генерируйте новую карту под каждый платёж — настоящие данные никогда не покидают ваш кошелёк.",
  alternates: { canonical: `${SITE}/qmaskcard` },
  openGraph: {
    type: "website",
    url: `${SITE}/qmaskcard`,
    title: "QMaskCard — Disposable Virtual Cards",
    description: "Одноразовые карты под каждую покупку. Real card never leaves your wallet.",
    siteName: "AEVION",
    images: [{ url: `${SITE}/qmaskcard/opengraph-image`, width: 1200, height: 630 }],
  },
  robots: { index: true, follow: true },
};

export default function QMaskCardLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
