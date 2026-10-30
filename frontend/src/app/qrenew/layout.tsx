import type { ReactNode } from "react";
import { ModuleMaturity } from "@/components/ModuleMaturity";

// Обёртка заведена 06.09.2026 ради плашки зрелости из каталога (см.
// components/ModuleMaturity.tsx). Метаданных здесь нет намеренно — они
// остаются у самой страницы.
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <ModuleMaturity id="qrenew" />
      {children}
    </>
  );
}
