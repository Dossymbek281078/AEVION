import type { ReactNode } from "react";

export const metadata = {
  title: "Сметный тренажёр — AEVION",
  description: "AI-тренажёр сметного дела РК. Учебный режим: подбор расценок, расчёт ЛСР, AI-советник.",
};

export default function SmetaTrainerLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`
        @media print {
          /* Скрываем всё кроме контента для печати */
          header, aside, nav, .print\\:hidden { display: none !important; }
          main { margin: 0 !important; padding: 0 !important; }
          .overflow-auto, .overflow-x-auto { overflow: visible !important; }
          table { page-break-inside: auto; font-size: 8pt; }
          tr { page-break-inside: avoid; }
          thead { display: table-header-group; }
          body { background: white !important; }
          @page { margin: 1.5cm; size: A4 landscape; }
        }
      `}</style>
      {children}
    </>
  );
}
