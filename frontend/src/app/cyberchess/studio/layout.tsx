import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Студия — режим стримера и сцены для OBS",
  description:
    "Мини-доска поверх стрима, чат Twitch, готовые цвета для OBS, подписи к ходам и управление голосом тренера. Для трансляций и подкастов прямо из приложения.",
  openGraph: {
    title: "Студия CyberChess — режим стримера и сцены для OBS",
    description:
      "Мини-доска поверх трансляции, чат Twitch, готовые цвета для OBS, подписи к ходам. Веди шахматный стрим прямо из браузера.",
    type: "website",
    url: "/cyberchess/studio",
  },
  twitter: {
    card: "summary_large_image",
    title: "Студия CyberChess · режим стримера",
    description: "Стрим-режим с мини-доской, чат Twitch, сцены для OBS, контроль голоса коуча.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
