import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Chessy Economy — внутриигровая валюта",
  description:
    "Chessy — AEV-нативная шахматная валюта. Аукцион партий, аренда коучей, подписки на стримеров, бонусы за дейли-челленджи. Реальная экономика, не косметика.",
  openGraph: {
    title: "Chessy Economy — валюта, аукционы, аренда коучей · CyberChess",
    description:
      "Экосистема Chessy: аукцион партий мастеров, аренда тренеров, подписки на стримеров. Зарабатываешь — играя.",
    type: "website",
    url: "/cyberchess/economy",
  },
  twitter: {
    card: "summary_large_image",
    title: "Chessy Economy · CyberChess",
    description: "Аукцион партий, аренда коучей, подписки на стримеров. Шахматная экономика на AEV.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
