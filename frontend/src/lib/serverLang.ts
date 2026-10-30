// Язык посетителя на СЕРВЕРЕ — для первого кадра клиентских страниц.
//
// ЗАЧЕМ (30.10.2026, решение Оркестратора). I18nProvider стартует с "en" (так
// требует гидрация) и словарь посетителя догружает отдельным куском, поэтому
// клиентская страница, говорящая словарём, отдаёт английский SSR-HTML и первый
// кадр, а русский появляется перерисовкой. Для /auth (вход — денежный экран
// основного, русского канала) это неприемлемо; следом — /qright и /bureau.
//
// Серверный макет маршрута решает язык здесь и отдаёт странице строки на нём
// (см. app/auth/layout.tsx + app/auth/authServerStrings.ts). Чтение cookies() и
// headers() делает маршрут динамическим — применять к отдельным маршрутам, НЕ к
// корневому макету (там это отключило бы статику всего сайта, см. app/layout.tsx).
//
// Порядок источников тот же, что у клиентского провайдера (lib/i18n.tsx):
// адрес /en/… → кука aevion_lang_v1 → Accept-Language → умолчание. Умолчание
// здесь "ru", а не "en", как у getServerLang() в i18n-server.ts: тот обслуживает
// страницы, у которых английский — родной.
//
// Про адрес: middleware (src/middleware.ts) переадресует /en/<путь> и /ru|/kk/<путь>
// на адрес без префикса, выставляя куку языка, — то есть до макета путь с
// префиксом обычно не доходит, а его выбор приезжает кукой. Путь здесь
// учитывается, когда он известен: передан вызывающим или приехал заголовком
// (x-aevion-pathname — если его когда-нибудь станет ставить middleware).
import { cookies, headers } from "next/headers";
import { LANG_COOKIE, LANGS, type Lang } from "./i18n-data";

export type ЗапросЯзыка = {
  /** Путь запроса, если известен: /en/auth → en. */
  pathname?: string | null;
  /** Значение куки aevion_lang_v1. */
  cookie?: string | null;
  /** Заголовок Accept-Language. */
  acceptLanguage?: string | null;
};

function isLang(x: unknown): x is Lang {
  return typeof x === "string" && (LANGS as readonly string[]).includes(x);
}

/** Чистая функция выбора — её и проверяет тест lib/__tests__/serverLang.test.ts. */
export function языкПоЗапросу(з: ЗапросЯзыка, умолчание: Lang = "ru"): Lang {
  const m = String(з.pathname ?? "").match(/^\/([a-z]{2})(?:\/|$)/i);
  const изПути = m?.[1]?.toLowerCase();
  if (isLang(изПути)) return изПути;

  if (isLang(з.cookie)) return з.cookie;

  for (const часть of String(з.acceptLanguage ?? "").toLowerCase().split(",")) {
    const тег = часть.trim().split(";")[0]?.trim();
    if (!тег) continue;
    if (тег.startsWith("kz")) return "kk";
    const код = тег.slice(0, 2);
    if (isLang(код)) return код;
  }
  return умолчание;
}

/**
 * Язык посетителя из текущего запроса: cookies() и headers() Next.
 * Вне запроса (сборка, тест без обёртки) источники недоступны — умолчание.
 */
export async function serverLang(умолчание: Lang = "ru"): Promise<Lang> {
  const з: ЗапросЯзыка = {};
  try {
    з.cookie = (await cookies()).get(LANG_COOKIE)?.value ?? null;
  } catch {
    /* вне запроса */
  }
  try {
    const h = await headers();
    з.acceptLanguage = h.get("accept-language");
    з.pathname = h.get("x-aevion-pathname");
  } catch {
    /* вне запроса */
  }
  return языкПоЗапросу(з, умолчание);
}
