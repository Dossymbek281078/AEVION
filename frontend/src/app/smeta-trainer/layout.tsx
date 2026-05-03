import type { ReactNode } from "react";

export const metadata = {
  title: "Сметный тренажёр — AEVION",
  description: "AI-тренажёр сметного дела РК. Учебный режим: подбор расценок, расчёт ЛСР, AI-советник.",
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
      {children}
    </>
  );
}
