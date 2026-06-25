import type { ReactNode } from "react";
import { AchievementToast } from "./components/AchievementToast";
import { AutoSyncBridge } from "./lib/useAutoSync";
import { KeyboardShortcuts } from "./components/KeyboardShortcuts";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Сметный тренажёр — AEVION",
    template: "%s | Смета · AEVION",
  },
  description:
    "AI-тренажёр сметного дела РК. Подбор расценок НДЦС РК, расчёт ЛСР, учебный режим, AI-советник на типовых ошибках.",
  keywords: ["смета", "AEVION", "ЛСР", "сметное дело", "расценки РК", "тренажёр"],
  openGraph: {
    title: "Сметный тренажёр · AEVION",
    description:
      "AI-тренажёр сметного дела РК. Подбор расценок НДЦС РК, расчёт ЛСР, учебный режим, AI-советник на типовых ошибках.",
    type: "website",
    siteName: "AEVION",
    url: "/smeta-trainer",
  },
  twitter: {
    card: "summary_large_image",
    title: "Сметный тренажёр · AEVION",
    description: "Учебный режим + AI-советник по ЛСР",
  },
};

export default function SmetaTrainerLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`
        /* ── Print ─────────────────────────────── */
        @media print {
          header, aside, nav, .print-hidden,
          [class*="print:hidden"] { display: none !important; }
          main { margin: 0 !important; padding: 0 !important; }
          .overflow-auto, .overflow-x-auto { overflow: visible !important; }
          table { page-break-inside: auto; font-size: 8pt; border-collapse: collapse; }
          tr { page-break-inside: avoid; }
          td, th { border: 1px solid #999 !important; }
          thead { display: table-header-group; }
          body { background: white !important; }
          @page { margin: 1.5cm; size: A4 landscape; }
        }

        /* ── Mobile helpers ────────────────────── */
        @media (max-width: 768px) {
          .mobile-hide { display: none !important; }
          .mobile-full { width: 100% !important; }
        }

        /* ── Table horizontal scroll on small screens ── */
        .lsr-table-wrap {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }

        /* ── Smooth drawer ─────────────────────── */
        .rate-drawer {
          transition: transform 0.2s ease-out;
        }

        /* ── Typing animation ──────────────────── */
        @keyframes pulse-dots {
          0%, 80%, 100% { opacity: 0.3; }
          40% { opacity: 1; }
        }
        .dot-1 { animation: pulse-dots 1.4s infinite 0s; }
        .dot-2 { animation: pulse-dots 1.4s infinite 0.2s; }
        .dot-3 { animation: pulse-dots 1.4s infinite 0.4s; }
      `}</style>
      {/* Skip to content для скринридеров и keyboard-only пользователей */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-emerald-600 focus:text-white focus:px-3 focus:py-1.5 focus:rounded focus:text-sm focus:font-semibold focus:shadow-lg"
      >
        Перейти к содержимому
      </a>
      <div id="main-content">{children}</div>
      <AchievementToast />
      <AutoSyncBridge />
      <KeyboardShortcuts />
    </>
  );
}
