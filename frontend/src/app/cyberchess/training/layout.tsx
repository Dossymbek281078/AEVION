import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Training Hub — daily-задания, эндшпиль, координаты",
  description:
    "Дейли-челленджи, тренажёр эндшпиля (12 классических позиций), координатный тренажёр, тест личности и репертуар. Прокачка по всем фронтам.",
  openGraph: {
    title: "CyberChess Training — daily, эндшпиль, координаты · CyberChess",
    description:
      "Тренажёры: эндшпиль, координаты, личность, репертуар + ежедневные задания. Все упражнения в одном хабе.",
    type: "website",
    url: "/cyberchess/training",
  },
  twitter: {
    card: "summary_large_image",
    title: "CyberChess Training Hub",
    description: "Эндшпиль · координаты · daily · личность · репертуар. Все тренажёры под одной крышей.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
