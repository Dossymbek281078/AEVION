import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Тренировки — задания дня, эндшпиль, координаты",
  description:
    "Дейли-челленджи, тренажёр эндшпиля (12 классических позиций), координатный тренажёр, тест личности и репертуар. Прокачка по всем фронтам.",
  openGraph: {
    title: "Тренировки CyberChess — задания дня, эндшпиль, координаты",
    description:
      "Тренажёры: эндшпиль, координаты, личность, репертуар + ежедневные задания. Все упражнения в одном хабе.",
    type: "website",
    url: "/cyberchess/training",
  },
  twitter: {
    card: "summary_large_image",
    title: "Тренировки · CyberChess",
    description: "Эндшпиль · координаты · задания дня · личность · репертуар. Все тренажёры под одной крышей.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
