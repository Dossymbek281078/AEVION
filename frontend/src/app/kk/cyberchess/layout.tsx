import type { Metadata, Viewport } from "next";
import SwRegister from "../../cyberchess/SwRegister";
import PwaInstall from "../../cyberchess/PwaInstall";

/*
 * /kk/cyberchess — қазақ маршруты (19.10.2026). Қазір тек МАРШРУТ пен МЕТА
 * қазақша: ойын экранының толық қазақ аудармасы — келесі толқын (Б).
 * middleware тек /en-ді өңдейді, сондықтан /kk/cyberchess осы маршрутпен
 * тікелей ашылады. Бет мазмұны — сол CyberChessPage компоненті.
 */
export const metadata: Metadata = {
  title: "CyberChess — ЖИ-жаттықтырушысы және жарты миллион есебі бар шахмат",
  description:
    "ЖИ-мен кез келген деңгейде ойнап, 500 000+ банктен есеп шығарыңыз. ЖИ-жаттықтырушы жүріс ұсынады, партияны талдайды және сұрақтарға жауап береді. AEVION-нан.",
  alternates: { canonical: "https://aevion.app/kk/cyberchess" },
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
    title: "CyberChess — ЖИ-коуч, CPI рейтингі, 12 нұсқа",
    description:
      "ЖИ-коуч Алекс · Composite Performance Index (11 фактор) · Stockfish multiPV · Chessy валютасы · қолданба ішіндегі стрим. AEVION CyberChess.",
    type: "website",
    locale: "kk_KZ",
    siteName: "AEVION CyberChess",
    url: "https://aevion.app/kk/cyberchess",
  },
  twitter: {
    card: "summary_large_image",
    title: "CyberChess — шахматтағы ең үздік ЖИ-коуч",
    description:
      "11 фактор бойынша CPI рейтингі · 12 нұсқа · 500 000+ есеп · Game DNA · тікелей түсіндірме. AEVION-нан.",
  },
};

export const viewport: Viewport = {
  themeColor: "#059669",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function KkCyberChessLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SwRegister />
      {children}
      <PwaInstall />
    </>
  );
}
