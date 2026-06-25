import type { Metadata } from "next";
import type { ReactNode } from "react";

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://aevion.app";

export const metadata: Metadata = {
  title: "Planet Constitutions — Leaderboard · AEVION",
  description:
    "Топ опубликованных конституций с QSign-подписями. Голосование за лучшие сценарии, похожие отпечатки по cosine similarity, deep-link применения ползунков одним кликом.",
  alternates: { canonical: `${SITE}/constitution/leaderboard` },
  openGraph: {
    title: "Planet Constitutions — Leaderboard",
    description: "Подписанные конституции из глобальной экосистемы AEVION.",
    url: `${SITE}/constitution/leaderboard`,
    type: "website",
  },
};

export default function LeaderboardLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
