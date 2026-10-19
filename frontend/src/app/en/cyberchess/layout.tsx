import type { Metadata, Viewport } from "next";
import SwRegister from "../../cyberchess/SwRegister";
import PwaInstall from "../../cyberchess/PwaInstall";

/*
 * /en/cyberchess — собственный АНГЛИЙСКИЙ маршрут шахмат (19.10.2026, неделя
 * шахмат). Раньше /en/cyberchess отвечал 308 на русскую /cyberchess, и превью
 * ссылки в письмах тренерам доставалось русским: краулер по редиректу куку
 * языка не несёт, поэтому английская мета обязана жить на самом адресе.
 * Игровой экран переключается на английский префиксом адреса (loadLocale в
 * cyberchess/i18n.ts). Текст страницы — тот же компонент CyberChessPage.
 */
export const metadata: Metadata = {
  title: "CyberChess — chess with an AI coach and half a million puzzles",
  description:
    "Play the AI at any level and solve puzzles from a bank of 500,000+. The AI coach suggests a move, reviews your game and answers your questions. From AEVION.",
  alternates: { canonical: "https://aevion.app/en/cyberchess" },
  manifest: "/cyberchess-manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "CyberChess" },
  icons: {
    icon: [
      { url: "/cyberchess-icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
      { url: "/cyberchess-icon-512.svg", sizes: "512x512", type: "image/svg+xml" },
    ],
    apple: [{ url: "/cyberchess-icon-192.svg" }],
  },
  openGraph: {
    title: "CyberChess — AI coach, CPI rating, 12 variants",
    description:
      "AI coach Alex · Composite Performance Index (11 factors) · Stockfish multiPV · Chessy currency · in-app streaming. AEVION CyberChess.",
    type: "website",
    locale: "en_US",
    siteName: "AEVION CyberChess",
    url: "https://aevion.app/en/cyberchess",
  },
  twitter: {
    card: "summary_large_image",
    title: "CyberChess — the best AI coach in chess",
    description:
      "CPI rating across 11 factors · 12 variants · 500,000+ puzzles · Game DNA · live commentary. From AEVION.",
  },
};

export const viewport: Viewport = {
  themeColor: "#059669",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function EnCyberChessLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SwRegister />
      {children}
      <PwaInstall />
    </>
  );
}
