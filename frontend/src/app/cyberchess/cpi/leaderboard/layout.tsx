import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CPI Leaderboard — лидерборд по любому фактору",
  description:
    "Топ игроков отдельно по точности, тактике, эндшпилю, контролю времени и ещё 7 параметрам. Не один-числовой Elo — а 11 разных пьедесталов.",
  openGraph: {
    title: "CPI Leaderboard — 11 разных пьедесталов · CyberChess",
    description:
      "Лидерборд по каждому фактору CPI отдельно. Будь №1 по эндшпилю, даже если общий рейтинг средний.",
    type: "website",
    url: "/cyberchess/cpi/leaderboard",
  },
  twitter: {
    card: "summary_large_image",
    title: "CyberChess CPI Leaderboard",
    description: "Лидерборд по любому из 11 факторов рейтинга. Не одна цифра — а 11 пьедесталов.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
