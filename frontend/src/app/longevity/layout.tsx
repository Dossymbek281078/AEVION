import type { ReactNode } from "react";
import { serverLang } from "@/lib/serverLang";
import { ServerLangProvider } from "@/lib/serverLangContext";

// Язык первого кадра платной стены (PaywallScreen) выбирает сервер: кука →
// Accept-Language → ru. Без макета SSR-кадр стены для русского гостя английский
// и перерисовывается после гидрации (lib/serverLangContext.tsx, 30.10.2026).
export const dynamic = "force-dynamic";

export default async function LongevityLayout({ children }: { children: ReactNode }) {
  const lang = await serverLang("ru");
  return <ServerLangProvider lang={lang}>{children}</ServerLangProvider>;
}
