import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Studio — Streamer mode и OBS-обвязка",
  description:
    "Streamer Studio: PiP-окно с Twitch-чатом, цветовые пресеты под OBS, авто-аннотации ходов, контроль голоса коуча. Для стримов и подкастов прямо из приложения.",
  openGraph: {
    title: "CyberChess Studio — стрим-режим с PiP и OBS · CyberChess",
    description:
      "PiP-окно поверх доски, Twitch-чат, OBS-пресеты, авто-аннотации. Стрими шахматы как профи прямо из браузера.",
    type: "website",
    url: "/cyberchess/studio",
  },
  twitter: {
    card: "summary_large_image",
    title: "CyberChess Studio · Streamer mode",
    description: "Стрим-режим с PiP, Twitch-чат, OBS-обвязка, контроль голоса коуча.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
