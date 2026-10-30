import type { ReactNode } from "react";
import { serverLang } from "@/lib/serverLang";
import { ServerLangProvider } from "@/lib/serverLangContext";

// First-frame language of the paywall screen (PaywallScreen) is chosen by the
// server: cookie -> Accept-Language -> ru. Without this layout the SSR frame of
// the wall is English for a Russian guest and repaints after hydration
// (lib/serverLangContext.tsx, 2026-10-30). Code here stays Latin-only: the
// neighbouring guard noRussianOutsideI18n scans every file in this folder.
export const dynamic = "force-dynamic";

export default async function QSkywayLayout({ children }: { children: ReactNode }) {
  const lang = await serverLang("ru");
  return <ServerLangProvider lang={lang}>{children}</ServerLangProvider>;
}
