import type { ReactNode } from "react";
import { ModuleMaturity } from "@/components/ModuleMaturity";

// Плашка зрелости из каталога (см. components/ModuleMaturity.tsx).
// Пока qspace не задеплоен в каталог бэкенда, компонент честно молчит.
// Метаданных здесь нет намеренно — они у самой страницы.
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <ModuleMaturity id="qspace" />
      {children}
    </>
  );
}
