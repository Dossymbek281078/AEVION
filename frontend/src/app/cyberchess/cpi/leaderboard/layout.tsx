import type { Metadata } from "next";

// Страница пока показывает образец, а не настоящих игроков (см. предупреждение
// в page.tsx). Страницу с выдуманными именами и рейтингами нельзя отдавать в
// поиск: там она станет «рейтингом игроков AEVION» без всякой оговорки.
// Снять, когда подключится настоящий источник.
export const metadata: Metadata = {
  robots: { index: false, follow: true },
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
