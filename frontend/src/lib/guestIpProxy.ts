/**
 * Прокси действий с бесплатной нормой: передаёт бэкенду адрес гостя.
 *
 * ПОВОД (замер прода 13.10.2026, окно Приложения-31.12). Railway перезаписывает
 * X-Forwarded-For адресом соединения, а через rewrite `/api-backend` соединение
 * идёт от Vercel — бэкенд видел всех гостей сайта под адресами Vercel, и
 * бесплатная норма (freeActionQuota) делилась между ними: счёт 2,3,2,3,4.
 * Заголовки, добавленные middleware (и через next(), и через rewrite), до
 * бэкенда НЕ доходили — счётчик /health guestIpFromSite.noKey рос. Поэтому
 * эти пути обслуживает свой обработчик, который сам делает запрос.
 *
 * Бэкенд верит адресу только при совпавшем секрете AEVION_EDGE_KEY.
 */

/** Заголовки для бэкенда: адрес гостя + секрет; подделка гостя затирается. */
export function заголовкиДляБэкенда(вход: Headers, сырой: string | undefined): Headers | null {
  // 13.10.2026: секрет, заведённый через конвейер PowerShell, пришёл с BOM
  // (U+FEFF) — Headers.set бросал «Cannot convert argument to a ByteString»,
  // и три платных действия отвечали 500. trim() снимает и BOM (U+FEFF — пробел
  // по стандарту), дальше допускаем только печатный ASCII.
  const секрет = (сырой || "").trim();
  if (секрет.length < 16 || !/^[\x21-\x7e]+$/.test(секрет)) return null;
  const адрес = (вход.get("x-forwarded-for") || "").split(",")[0].trim() || (вход.get("x-real-ip") || "").trim();
  const выход = new Headers(вход);
  выход.delete("x-aevion-client-ip");
  выход.delete("x-aevion-edge-key");
  if (!адрес) return выход;
  выход.set("x-aevion-client-ip", адрес);
  выход.set("x-aevion-edge-key", секрет);
  return выход;
}

// Не пересылаем: их выставляет сам fetch/платформа, а чужой host уводит
// запрос Railway не в тот сервис.
const НЕ_ПЕРЕСЫЛАТЬ = ["host", "content-length", "connection", "accept-encoding", "transfer-encoding"];

/** Переслать запрос на бэкенд с адресом гостя. `путь` — от корня бэкенда, например `/api/healthai/check`. */
export async function проксироватьСАдресом(req: Request, путь: string): Promise<Response> {
  const база = (process.env.BACKEND_PROXY_TARGET || "").trim().replace(/\/+$/, "");
  if (!база) return Response.json({ error: "backend_unconfigured" }, { status: 503 });
  const заголовки = заголовкиДляБэкенда(req.headers, process.env.AEVION_EDGE_KEY) ?? new Headers(req.headers);
  for (const и of НЕ_ПЕРЕСЫЛАТЬ) заголовки.delete(и);
  const поиск = new URL(req.url).search;
  let ответ: Response;
  try {
    ответ = await fetch(база + путь + поиск, {
      method: req.method,
      headers: заголовки,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer(),
      redirect: "manual",
      cache: "no-store",
    });
  } catch {
    return Response.json({ error: "backend_unreachable" }, { status: 502 });
  }
  const наружу = new Headers(ответ.headers);
  наружу.delete("content-encoding");
  наружу.delete("content-length");
  наружу.delete("transfer-encoding");
  return new Response(ответ.body, { status: ответ.status, headers: наружу });
}
