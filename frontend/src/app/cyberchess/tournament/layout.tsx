import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tournament Hub — турниры, brackets, лидерборд",
  description:
    "Турнирная сетка с визуализацией bracket, cross-tournament лидерборд, бейджи за достижения. Стандартные шахматы и 12 вариантов.",
  openGraph: {
    title: "CyberChess Tournament Hub — bracket, leaderboard, badges",
    description:
      "Турниры с bracket-визуализацией, сквозной лидерборд, бейджи. Стандарт + 12 вариантов под одной крышей.",
    type: "website",
    url: "/cyberchess/tournament",
  },
  twitter: {
    card: "summary_large_image",
    title: "CyberChess Tournament Hub",
    description: "Bracket viz · cross-tournament leaderboard · badges. 12 вариантов + стандарт.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
