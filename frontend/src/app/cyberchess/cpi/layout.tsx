import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CPI — Composite Performance Index",
  description:
    "Принципиально новый шахматный рейтинг: 11 факторов вместо одной Elo-цифры. Очки даже за поражение, если качество хода высокое. Лидерборд по любому фактору.",
  openGraph: {
    title: "CPI — рейтинг шахматиста по 11 факторам · CyberChess",
    description:
      "Композитный индекс качества: точность, тактика, эндшпиль, время, психология. Очки даже за поражение, если хорошо играл.",
    type: "website",
    url: "/cyberchess/cpi",
  },
  twitter: {
    card: "summary_large_image",
    title: "CPI — шахматный рейтинг новой эры",
    description: "11 факторов · очки за качество хода даже в поражении · лидерборд по любому фактору.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
