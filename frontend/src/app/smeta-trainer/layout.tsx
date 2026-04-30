import type { ReactNode } from "react";

export const metadata = {
  title: "Сметный тренажёр — AEVION",
  description: "AI-тренажёр сметного дела РК. Учебный режим: подбор расценок, расчёт ЛСР, AI-советник.",
};

export default function SmetaTrainerLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
