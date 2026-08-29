import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Турнирный хаб — турниры, сетки, таблица лидеров",
  description:
    "Сетка турнира, сквозная таблица лидеров по всем турнирам, награды за достижения. Стандартные шахматы и 12 вариантов.",
  openGraph: {
    title: "Турнирный хаб CyberChess — сетки, таблица лидеров, трофеи",
    description:
      "Турниры с наглядной сеткой, сквозная таблица лидеров, значки. Стандарт + 12 вариантов под одной крышей.",
    type: "website",
    url: "/cyberchess/tournament",
  },
  twitter: {
    card: "summary_large_image",
    title: "Турнирный хаб · CyberChess",
    description: "Сетка турнира · сквозная таблица лидеров · трофеи. 12 вариантов, призовой фонд в Chessy.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
