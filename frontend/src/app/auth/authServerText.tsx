"use client";

import { createContext, useContext, useMemo } from "react";
import type { Lang } from "@/lib/i18n-data";

/**
 * Строки первого кадра /auth, выбранные сервером (см. authServerStrings.ts и
 * auth/layout.tsx). Клиентская обёртка: макет — серверный компонент и не может
 * положить значение в контекст сам.
 */
export type ТекстПервогоКадра = { lang: Lang; strings: Record<string, string> };

const Ctx = createContext<ТекстПервогоКадра | null>(null);

export function AuthServerTextProvider({ lang, strings, children }: ТекстПервогоКадра & { children: React.ReactNode }) {
  const value = useMemo(() => ({ lang, strings }), [lang, strings]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** null — страница нарисована без макета (тесты одиночного компонента). */
export function useAuthServerText(): ТекстПервогоКадра | null {
  return useContext(Ctx);
}
