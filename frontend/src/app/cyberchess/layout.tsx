import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "CyberChess — AI-тренер и пазлы",
  description:
    "Шахматы нового поколения: AI-коуч Алексей, Blunder Rewind, Puzzle Rush с time-bonus, Game DNA, голосовой ввод. От AEVION.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CyberChess",
  },
  icons: {
    icon: [
      { url: "/cyberchess-icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
      { url: "/cyberchess-icon-512.svg", sizes: "512x512", type: "image/svg+xml" },
    ],
    apple: [{ url: "/cyberchess-icon-192.svg" }],
  },
  openGraph: {
    title: "CyberChess — AI-коуч, CPI рейтинг, 12 вариантов",
    description:
      "AI-коуч Алексей · Composite Performance Index (11 факторов) · Stockfish multiPV · Chessy currency · стрим-в-приложении. Обходит lichess + chess.com системно.",
    type: "website",
    siteName: "AEVION CyberChess",
    url: "/cyberchess",
  },
  twitter: {
    card: "summary_large_image",
    title: "CyberChess — лучший AI-коуч в шахматах",
    description:
      "CPI рейтинг по 11 факторам · 12 вариантов · 5800+ пазлов · Game DNA · live-комментарии. От AEVION.",
  },
};

export const viewport: Viewport = {
  themeColor: "#059669",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function CyberChessLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
