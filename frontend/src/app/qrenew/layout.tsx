import type { ReactNode } from "react";
import { ModuleMaturity } from "@/components/ModuleMaturity";
import { serverLang } from "@/lib/serverLang";
import { ServerLangProvider } from "@/lib/serverLangContext";

// Язык первого кадра платной стены (PaywallScreen) выбирает сервер: кука →
// Accept-Language → ru (lib/serverLangContext.tsx, 30.10.2026).
export const dynamic = "force-dynamic";

// Обёртка заведена 06.09.2026 ради плашки зрелости из каталога (см.
// components/ModuleMaturity.tsx). Метаданных здесь нет намеренно — они
// остаются у самой страницы.
export default async function Layout({ children }: { children: ReactNode }) {
  const lang = await serverLang("ru");
  return (
    <ServerLangProvider lang={lang}>
      <ModuleMaturity id="qrenew" />
      {children}
    </ServerLangProvider>
  );
}
