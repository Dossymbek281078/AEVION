import type { ReactNode } from "react";
import type { Metadata } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://aevion.app";

export const metadata: Metadata = {
  // Было «Privacy Proxy + Tor-routing». Собственный реестр модулей говорит обратное:
  // moduleRuntime.ts — «Tor-прокси остаётся roadmap Q4'26 (waitlist)», projects.ts —
  // «Tor-proxy roadmap Q4 2026». Живёт сканер раскрытия и утечек, он и в заголовке.
  title: "VeilNetX — Privacy Exposure Scanner · AEVION",
  description:
    "Privacy-сканер: что ваш запрос раскрывает серверу (IP, гео, User-Agent, Client-Hints) и какие утечки даёт браузер (WebRTC, энтропия отпечатка). Без логов, без email, без KYC. Tor-прокси — в плане на Q4 2026.",
  alternates: { canonical: `${SITE}/veilnetx` },
  openGraph: {
    type: "website",
    url: `${SITE}/veilnetx`,
    title: "VeilNetX — Privacy Exposure Scanner",
    description: "Exposure scan · browser leak check · no logs · no email · no KYC. Tor proxy on the Q4 2026 roadmap.",
    siteName: "AEVION",
    images: [{ url: `${SITE}/veilnetx/opengraph-image`, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    // Twitter-карточку июльская правка пропустила: заголовок и метаописание
    // уже говорили про сканер, а сюда репостилось прежнее «Tor-routed».
    title: "VeilNetX · Privacy Exposure Scanner",
    description: "Exposure scan · browser leak check · no logs · no KYC.",
  },
  robots: { index: true, follow: true },
};

export default function VeilNetXLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
