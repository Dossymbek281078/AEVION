import type { Metadata, Viewport } from "next";
import SwRegister from "./SwRegister";
import PwaInstall from "./PwaInstall";
import RussianOnlyNotice from "./RussianOnlyNotice";
export const metadata: Metadata = {
  title: "CyberChess — шахматы с ИИ-тренером и полумиллионом задач",
  description:
    // 🔴 30.09.2026, до поста о запуске. «Тренер объяснит КАЖДЫЙ ход» —
    // обещание сильнее продукта: тренер отвечает на вопрос и разбирает
    // позицию, но покомментировать всю партию ход за ходом не берётся.
    // Описание видит человек в выдаче и в превью пересланной ссылки, то
    // есть это продающий текст, и он должен быть не щедрее того, что
    // получат. Заодно убрано «разбирайте партии» из первой половины:
    // вместе с новой формулировкой выходил повтор в одном предложении.
    // 🔴 И «подберёт упражнения под вашу слабую сторону» тоже убрано.
    // Замер: слабости действительно копятся и уходят тренеру в промпт
    // (AiCoach.tsx, поле weaknesses при blunder/mistake). Но это «тренер
    // ЗНАЕТ о слабостях», а не «подбирает под них упражнения»: отбор
    // задач идёт фильтрами по теме, которые ставит сам человек.
    "Играйте с ИИ любого уровня и решайте задачи: ИИ-тренер подскажет ход, разберёт партию и покажет ошибки. От AEVION.",
  manifest: "/cyberchess-manifest.webmanifest",
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
    title: "CyberChess — ИИ-коуч, CPI рейтинг, 12 вариантов",
    description:
      "ИИ-коуч Алексей · Composite Performance Index (11 факторов) · Stockfish multiPV · Chessy currency · стрим-в-приложении. AEVION CyberChess.",
    type: "website",
    // Содержимое страницы русское, а корневой layout объявляет lang="en".
    // Без locale превью в мессенджерах и соцсетях достаётся английская метка.
    locale: "ru_RU",
    siteName: "AEVION CyberChess",
    url: "/cyberchess",
  },
  twitter: {
    card: "summary_large_image",
    title: "CyberChess — лучший ИИ-коуч в шахматах",
    description:
      // 5800+ было верно, когда банк собирали вручную. Живой замер 20.08.2026:
      // 502 584 задачи (GET /api/cyberchess-puzzles). Занижение в 86 раз стояло
      // ровно там, где его труднее всего заметить, — в описании превью, которое
      // видит человек, когда ссылку ПЕРЕСЫЛАЮТ. Число здесь округлённое
      // намеренно: точное растёт, а метаданные кэшируются и живут долго.
      "CPI рейтинг по 11 факторам · 12 вариантов · 500 000+ задач · Game DNA · live-комментарии. От AEVION.",
  },
};

export const viewport: Viewport = {
  themeColor: "#059669",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function CyberChessLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SwRegister />
      <RussianOnlyNotice />
      {children}
      <PwaInstall />
    </>
  );
}
