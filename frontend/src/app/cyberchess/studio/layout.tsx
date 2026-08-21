import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Студия — режим стримера и обвязка для OBS",
  description:
    "Streamer Studio: PiP-окно с Twitch-чатом, цветовые пресеты под OBS, авто-аннотации ходов, контроль голоса коуча. Для стримов и подкастов прямо из приложения.",
  openGraph: {
    title: "Студия CyberChess — режим стримера с PiP и OBS",
    description:
      "PiP-окно поверх доски, Twitch-чат, OBS-пресеты, авто-аннотации. Стрими шахматы как профи прямо из браузера.",
    type: "website",
    url: "/cyberchess/studio",
  },
  twitter: {
    card: "summary_large_image",
    title: "Студия CyberChess · режим стримера",
    description: "Стрим-режим с PiP, Twitch-чат, OBS-обвязка, контроль голоса коуча.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
