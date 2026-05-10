import type { ReactNode } from "react";
import type { Metadata } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://aevion.app";

export const metadata: Metadata = {
  title: "QContract — Self-Destruct Smart Documents · AEVION",
  description:
    "Саморазрушающиеся смарт-документы: burn-after-N-reads, time expiry, password gate, email-watermark, QRight-сертификация. Stripe-alternative для конфиденциальной передачи.",
  alternates: { canonical: `${SITE}/qcontract` },
  openGraph: {
    type: "website",
    url: `${SITE}/qcontract`,
    title: "QContract — Self-Destruct Smart Documents",
    description:
      "Самоудаляющиеся документы с лимитом просмотров, паролем, watermark и аудит-логом.",
    siteName: "AEVION",
    images: [{ url: `${SITE}/qcontract/opengraph-image`, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "QContract · Self-Destruct Documents",
    description:
      "Burn-after-read smart documents with watermark, audit log, QRight cert.",
  },
  robots: { index: true, follow: true },
};

export default function QContractLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
