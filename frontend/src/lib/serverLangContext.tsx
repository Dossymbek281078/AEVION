"use client";

import { createContext, useContext } from "react";
import type { Lang } from "./i18n-data";
import { useI18nOptional } from "./i18n";
import { ServerFrameTextProvider } from "./serverFrameText";

/**
 * Язык первого кадра, выбранный СЕРВЕРОМ (lib/serverLang.ts), — для клиентских
 * страниц с синхронным словарём (/bureau: bureauText.ts, /qright: qrightI18n.ts).
 *
 * ЗАЧЕМ (30.10.2026, решение Оркестратора). I18nProvider стартует с "en" и язык
 * определяет уже в браузере, поэтому страница с `useI18n().lang ?? "en"` отдаёт
 * английский SSR-HTML и первый кадр — русский гость из соцсети видел «Protect
 * Your Work» на денежных страницах. Серверный макет маршрута (force-dynamic)
 * решает язык по куке и Accept-Language (умолчание ru) и кладёт его сюда;
 * страница берёт его, пока провайдер не определил язык (langReady), — SSR,
 * первый кадр и гидрация совпадают. /auth делает то же своим контекстом со
 * строками (auth/authServerText.tsx): там словарь асинхронный, здесь — в бандле,
 * поэтому достаточно одного языка.
 */
const Ctx = createContext<Lang | null>(null);

/**
 * Обёртка без собственной геометрии (display: contents): lang — ближайшее
 * объявление языка для читалки и переводчика браузера (язык кадра), data-server-lang —
 * маркер в сыром HTML, по которому прод проверяется curl'ом (/bureau рисуется
 * целиком на клиенте, h1 в SSR у него нет — виден только этот маркер).
 */
export function ServerLangProvider({
  lang,
  frameStrings,
  children,
}: {
  lang: Lang;
  /** Строки t() первого кадра (lib/serverFrameStrings.ts) — для страниц, говорящих словарём I18nProvider. */
  frameStrings?: Record<string, string>;
  children: React.ReactNode;
}) {
  const тело = <ОбёрткаЯзыка серверный={lang}>{children}</ОбёрткаЯзыка>;
  return (
    <Ctx.Provider value={lang}>
      {frameStrings ? (
        <ServerFrameTextProvider lang={lang} strings={frameStrings}>
          {тело}
        </ServerFrameTextProvider>
      ) : (
        тело
      )}
    </Ctx.Provider>
  );
}

/**
 * 31.10.2026: lang берётся из языка КАДРА, а не навсегда из серверного: после смены
 * языка в клиенте атрибут иначе устаревал (читалка и переводчик браузера читали старый).
 * data-server-lang остаётся серверным — по нему curl-приёмка проверяет сырой HTML.
 */
function ОбёрткаЯзыка({ серверный, children }: { серверный: Lang; children: React.ReactNode }) {
  const язык = языкКадра(useI18nOptional(), серверный, серверный);
  return (
    <div lang={язык} data-server-lang={серверный} style={{ display: "contents" }}>
      {children}
    </div>
  );
}

/** null — страница нарисована без серверного макета (тест одиночного компонента). */
export function useServerLang(): Lang | null {
  return useContext(Ctx);
}

/**
 * Язык страницы для текущего кадра: провайдер определил язык → его; иначе —
 * серверный; без макета — `умолчание` (прежнее поведение страницы).
 */
export function языкКадра(
  i18n: { lang: Lang; langReady: boolean } | null | undefined,
  серверный: Lang | null,
  умолчание: Lang = "en",
): Lang {
  if (i18n?.langReady) return i18n.lang;
  return серверный ?? i18n?.lang ?? умолчание;
}
