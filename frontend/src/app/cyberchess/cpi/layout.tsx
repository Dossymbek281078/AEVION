import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CPI — составной рейтинг качества игры",
  description:
    "Принципиально новый шахматный рейтинг: 11 факторов вместо одной Elo-цифры. Очки даже за поражение, если качество хода высокое. Таблица лидеров по любому фактору.",
  openGraph: {
    title: "CPI — рейтинг шахматиста по 11 факторам · CyberChess",
    description:
      "Составной индекс качества: точность, тактика, эндшпиль, время, психология. Очки даже за поражение, если хорошо играл.",
    type: "website",
    url: "/cyberchess/cpi",
  },
  twitter: {
    card: "summary_large_image",
    title: "CPI — шахматный рейтинг новой эры",
    description: "11 факторов · очки за качество хода даже в поражении · таблица лидеров по любому фактору.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
