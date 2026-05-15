import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CPI Dashboard — личная статистика по факторам",
  description:
    "SVG-графики динамики CPI: точность, тактика, эндшпиль, тайминг, агрессия, контроль времени. Видишь, какой фактор тянет тебя вниз — и над чем работать.",
  openGraph: {
    title: "CPI Dashboard — личная статистика шахматиста · CyberChess",
    description: "Графики CPI по 11 факторам, тренды, разбивка по фазам партии. Видишь свой слабый профиль.",
    type: "website",
    url: "/cyberchess/cpi/dashboard",
  },
  twitter: {
    card: "summary_large_image",
    title: "Personal CPI Dashboard · CyberChess",
    description: "11 факторов рейтинга, тренды, слабые зоны — на одном экране.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
