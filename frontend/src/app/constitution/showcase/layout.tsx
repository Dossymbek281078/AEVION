import type { Metadata } from "next";
import type { ReactNode } from "react";

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://aevion.app";

export const metadata: Metadata = {
  title: "AEVION Constitution — Show me the product in 30 seconds",
  description:
    "Лаборатория устройства мира на 8 ползунках. Open Access vs Nordic vs Authoritarian — одной анимацией. Open-source, QSign-подписанные сценарии, AI-советник, $9/mo Pro.",
  alternates: { canonical: `${SITE}/constitution/showcase` },
  openGraph: {
    title: "Constitution Simulator — продукт за 30 секунд",
    description: "8 ползунков × 10 режимов × 4 опоры. От Magna Carta до Open Access за 8 веков.",
    url: `${SITE}/constitution/showcase`,
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "Constitution — продукт за 30 секунд" },
};

export default function ShowcaseLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
