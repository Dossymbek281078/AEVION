"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import type { Lang } from "./i18n-data";
import { interpolate, peekDict, useI18nOptional } from "./i18n";
import en from "./i18n-lang/en";

/**
 * Строки первого кадра, выбранные СЕРВЕРОМ, для страниц, чьи тексты идут через
 * t() из I18nProvider (главная «/», /pricing). Тот же приём, что у /auth
 * (app/auth/authServerText.tsx), но общий: набор ключей маршрут выбирает сам
 * (lib/serverFrameStrings.ts).
 *
 * ЗАЧЕМ (30.10.2026). I18nProvider стартует с "en" и словарь догружает куском,
 * поэтому t() до langReady отдаёт английский: русский гость из соцсети видел
 * английский h1 главной и смесь ru/en на /pricing (строки tp() уже русские, а
 * t() — английские). useFrameT() до готовности провайдера отдаёт серверные
 * строки; SSR, первый кадр и гидрация совпадают.
 */
export type ТекстКадра = { lang: Lang; strings: Record<string, string> };

const Ctx = createContext<ТекстКадра | null>(null);

export function ServerFrameTextProvider({ lang, strings, children }: ТекстКадра & { children: React.ReactNode }) {
  const value = useMemo(() => ({ lang, strings }), [lang, strings]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export type FrameT = (key: string, vars?: Record<string, string | number>) => string;

/**
 * Замена `useI18n().t`: язык определён и словарь скачан → словарь провайдера;
 * иначе серверная строка (если язык совпадает с серверным); иначе — t() провайдера
 * (английский запас), без провайдера и макета — английский словарь.
 */
export function useFrameT(): FrameT {
  const i18n = useI18nOptional();
  const серверный = useContext(Ctx);
  // Ссылка на t стабильна, пока не сменились язык/словарь (i18n.t меняется при загрузке словаря):
  // t стоит в списках зависимостей эффектов страниц.
  const tИз = i18n?.t;
  const готов = i18n?.langReady === true;
  const язык = i18n?.lang;
  return useCallback<FrameT>(
    (key, vars) => {
      if (tИз && готов && язык && peekDict(язык)) return tИз(key, vars);
      const строка = серверный && (!готов || серверный.lang === язык) ? серверный.strings[key] : undefined;
      if (строка !== undefined) return interpolate(строка, vars);
      if (tИз) return tИз(key, vars);
      return interpolate(en[key] ?? key, vars);
    },
    [tИз, готов, язык, серверный],
  );
}
