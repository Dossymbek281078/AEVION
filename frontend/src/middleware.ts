import { NextResponse } from "next/server";
import { hasOwnEnglishPage } from "@/lib/englishPages";
import type { NextRequest } from "next/server";

/**
 * Плохой запрос — это 400, а не 500.
 *
 * ПОВОД (замер 28.08.2026 по проду). Адрес с валидным percent-encoding, но
 * НЕВАЛИДНЫМ UTF-8 роняет рендер:
 *
 *   /%FF%FE            -> 500      /nonexistent-top/%FF%FE -> 404
 *   /pricing/%FF%FE    -> 500      /abc%                   -> 400 (отбивает край сети)
 *   /qsign/verify/%FF%FE -> 500
 *
 * Тело ответа — страница Next.js с `id="__next_error__"`, то есть необработанное
 * исключение. Проверено на ВСЕХ 74 семействах динамических маршрутов сайта:
 * пятисотят 74 из 74. Закономерность: 500 возникает ровно тогда, когда маршрут
 * СОВПАЛ и начал разбирать сегмент; если первый сегмент не совпадает ни с чем,
 * ответ честный 404.
 *
 * Тот же путь на бэкенде (`api.aevion.app/%FF%FE`) отвечает 404 — то есть
 * дефект только у сайта.
 *
 * ПОЧЕМУ ЭТО ВАЖНО. 5xx означает «сломались мы»: попадает в тревоги, поднимает
 * людей и топит в шуме настоящие аварии. Вызывается одним запросом любого
 * робота или сканера, а перед запуском их станет больше. Правильный ответ на
 * плохой запрос — 4xx (память feedback_client_error_becomes_server_error).
 *
 * ПОЧЕМУ ОДИН ФАЙЛ, А НЕ 74 ПРАВКИ. Разбор пути происходит ДО кода страниц, и
 * чинить это в каждом маршруте значило бы 74 одинаковые правки в чужих зонах,
 * каждая со своим шансом ошибиться. Middleware выполняется раньше маршрутизации
 * и закрывает класс целиком.
 *
 * ЧЕГО ЭТОТ ФАЙЛ НЕ ДЕЛАЕТ. Он не чинит «мягкие 404» — страницы, которые
 * отвечают 200 на несуществующий идентификатор (68 семейств из 74). Там нужен
 * `notFound()` в самой странице, потому что только она знает, нашёлся ли объект.
 */

/**
 * Можно ли разобрать путь. Вынесено отдельно и экспортируется, чтобы
 * проверяться тестом без поднятия Next.
 *
 * Возвращает `false` ТОЛЬКО на `URIError` от разбора. Любая другая неожиданность
 * пропускается дальше: middleware, роняющий обычные запросы, хуже дефекта,
 * который он лечит.
 */
export function isDecodablePath(pathname: string): boolean {
  try {
    decodeURIComponent(pathname);
    return true;
  } catch (e) {
    if (e instanceof URIError) return false;
    return true;
  }
}

/**
 * Английские адреса без своей страницы: /en/pricing и подобные.
 *
 * Замер 29.09.2026 показал, что английского сайта почти нет: из десяти
 * проверенных адресов живы четыре — /en/devhub, /en/devhub/launch, /en/shop и
 * /en/go; /en, /en/pricing, /en/apps, /en/qventure, /en/bureau, /en/cyberchess,
 * /en/about, /en/contact отвечали 404, тогда как те же страницы без /en — 200.
 * Человек приходил с Product Hunt на английский DevHub, нажимал «Pricing» и
 * получал «страница не найдена».
 *
 * Лечение дешёвое: адрес без своей английской страницы переадресуется на
 * русский аналог и ставит язык en — страница у нас одна, отличается только
 * словарь. Владелец языка (окно user-0c) сделал язык из АДРЕСА сильнее
 * сохранённого выбора, поэтому вместе с переадресацией достаточно поставить
 * куку: человек остаётся с английским.
 *
 * Разбор пути намеренно через split, а не регуляркой: пре-гидрационные
 * скрипты и middleware извлекаются тестами как сырой текст, и регулярка со
 * слэшами ломается при извлечении — предупреждение владельца, проверено им
 * запуском.
 */
// Список переехал в lib/englishPages.ts: им пользуются И middleware, И сами
// страницы. Два набора разошлись 01.10.2026 и дали бесконечную переадресацию на
// /longevity и /qskyway. Имя экспорта сохранено — его читают прежние тесты.
export { АНГЛИЙСКИЕ_СТРАНИЦЫ_СО_СВОИМ_АДРЕСОМ } from "@/lib/englishPages";

export function английскийРедирект(pathname: string | null | undefined): string | null {
  const путь = String(pathname ?? "");
  const части = путь.split("/").filter(Boolean);
  if (части.length === 0) return null;
  if (части[0].toLowerCase() !== "en") return null;

  // Своя английская страница — не трогаем.
  const безХвоста = "/" + части.join("/");
  if (hasOwnEnglishPage(безХвоста)) return null;

  // /en → главная; /en/<что-то> → тот же адрес без префикса.
  if (части.length === 1) return "/";
  return "/" + части.slice(1).join("/");
}

function битыйАдрес(): NextResponse {
  // Тело намеренно короткое и без разметки: это ответ роботу, а не человеку.
  // Имён внутренних систем здесь быть не должно (feedback_error_text_leaks_infrastructure).
  return new NextResponse("Bad Request: malformed percent-encoding in path\n", {
    status: 400,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      // Поисковику незачем возвращаться к битому адресу.
      "x-robots-tag": "noindex",
      "cache-control": "public, max-age=3600",
    },
  });
}

/**
 * Адрес гостя для бэкенда за прокси `/api-backend`.
 *
 * ПОВОД (замер 13.10.2026, окно Приложения-31.12). Railway перезаписывает
 * X-Forwarded-For адресом соединения, а соединение через rewrite идёт от
 * Vercel — бэкенд видел всех гостей сайта под одним-двумя адресами Vercel, и
 * бесплатная норма (freeActionQuota) делилась между ними: счёт 2,3,2,3,4.
 *
 * Vercel пишет настоящий адрес гостя первым в X-Forwarded-For; передаём его
 * своим заголовком вместе с секретом, которому верит бэкенд. Присланные
 * гостем одноимённые заголовки затираются. Без секрета — null, ничего не меняем.
 */
export function заголовкиДляБэкенда(вход: Headers, секрет: string | undefined): Headers | null {
  if (!секрет || секрет.length < 16) return null;
  const адрес = (вход.get("x-forwarded-for") || "").split(",")[0].trim() || (вход.get("x-real-ip") || "").trim();
  const выход = new Headers(вход);
  выход.delete("x-aevion-client-ip");
  выход.delete("x-aevion-edge-key");
  if (!адрес) return выход;
  выход.set("x-aevion-client-ip", адрес);
  выход.set("x-aevion-edge-key", секрет);
  return выход;
}

/** Пути с бесплатной нормой действий (бэкенд freeActionQuota) — только POST. */
const ПУТИ_С_НОРМОЙ = ["/api/healthai/", "/api/bureau/verify/start", "/api/qventure/", "/api/qsign/", "/api/qright/"];

/** Куда middleware сам проксирует запрос с адресом гостя, или null — прежний путь. */
export function адресНаБэкенде(
  метод: string,
  путь: string,
  запрос: string,
  цель: string | undefined,
): URL | null {
  const база = (цель || "").trim().replace(/\/+$/, "");
  if (метод !== "POST" || !/^https:\/\//.test(база)) return null;
  const хвост = путь.slice("/api-backend".length);
  if (!ПУТИ_С_НОРМОЙ.some((п) => хвост.startsWith(п))) return null;
  return new URL(база + хвост + запрос);
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!isDecodablePath(pathname)) {
    return битыйАдрес();
  }

  const цель = английскийРедирект(pathname);
  if (цель) {
    const адрес = new URL(цель, req.url);
    адрес.search = req.nextUrl.search;
    const ответ = NextResponse.redirect(адрес, 308);
    // Постоянная переадресация кэшируется, поэтому язык ставим здесь же:
    // иначе человек приедет на русскую страницу без признака английского.
    ответ.cookies.set("aevion_lang_v1", "en", { path: "/", maxAge: 60 * 60 * 24 * 365 });
    return ответ;
  }

  if (pathname.startsWith("/api-backend/")) {
    // Замер прода 13.10.2026 (/health → guestIpFromSite.noKey): заголовки из
    // NextResponse.next() до бэкенда НЕ доходят — внешний rewrite из
    // next.config их теряет. Поэтому для действий с бесплатной нормой
    // middleware проксирует сам; остальной трафик API идёт прежним путём.
    const куда = адресНаБэкенде(req.method, pathname, req.nextUrl.search, process.env.BACKEND_PROXY_TARGET);
    const заголовки = куда ? заголовкиДляБэкенда(req.headers, process.env.AEVION_EDGE_KEY) : null;
    if (куда && заголовки) {
      заголовки.delete("host");
      const ответ = NextResponse.rewrite(куда, { request: { headers: заголовки } });
      ответ.headers.set("x-aevion-edge", "guest-ip");
      return ответ;
    }
  }

  return NextResponse.next();

  return битыйАдрес();
}

/**
 * Куда middleware НЕ вмешивается.
 *
 * Статику и картинки отдаёт край сети, свои маршруты Next обслуживает сам —
 * лишний проход по ним стоил бы денег на каждом запросе и ничего не давал бы.
 * Шаблон намеренно консервативный: правило про «не навреди» здесь важнее
 * полноты, а битый адрес до статики всё равно не доходит.
 */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
