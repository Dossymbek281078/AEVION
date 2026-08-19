import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Экономика Chessy — внутриигровая валюта",
  description:
    "Chessy — AEV-нативная шахматная валюта. Аукцион партий, аренда коучей, подписки на стримеров, бонусы за дейли-челленджи. Реальная экономика, не косметика.",
  openGraph: {
    title: "Экономика Chessy — валюта, аукционы, аренда коучей · CyberChess",
    description:
      "Экосистема Chessy: аукцион партий мастеров, аренда тренеров, подписки на стримеров. Зарабатываешь — играя.",
    type: "website",
    url: "/cyberchess/economy",
  },
  twitter: {
    card: "summary_large_image",
    title: "Экономика Chessy · CyberChess",
    description: "Аукцион партий, аренда коучей, подписки на стримеров. Шахматная экономика на AEV.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
