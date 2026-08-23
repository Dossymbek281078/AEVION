import type { Request, Response, NextFunction } from "express";

import { captureException } from "./sentry";
import { BODY_LIMITS, GLOBAL_BODY_LIMIT_BYTES, requestPath } from "./bodyLimitByPath";

/**
 * Единый обработчик ошибок Express.
 *
 * Жил внутри `index.ts` и потому не проверялся ничем: чтобы дотянуться до него
 * в тесте, пришлось бы поднять весь сервер. Вынесен в модуль ради проверки, а
 * не ради красоты — дефект ниже прожил в нём незамеченным именно поэтому.
 *
 * Замерено 13.08.2026 на боевом коде: битый JSON и тело больше 10 МБ оба
 * отвечали `500 internal_error` и оба уходили в Sentry. Два последствия, и
 * второе хуже первого:
 *
 *   1. Отправитель не может отличить «я послал не то» от «сервер сломан».
 *      Публичная проверка чека (POST /api/multichat/receipt/verify) — путь, куда
 *      человек загружает СКАЧАННЫЙ файл, и большой чек давал ему «внутреннюю
 *      ошибку» вместо «файл слишком большой».
 *   2. Квоту Sentry расходует кто угодно одной строкой: `curl -d '{'`.
 *      Настоящие ошибки тонут в шуме — канал тревоги, который глушится снаружи,
 *      защищает хуже, чем кажется.
 */

/**
 * Ошибка, у которой сам источник назвал код ответа из диапазона 4xx.
 *
 * body-parser (express.json) ставит его на своих отказах: `entity.too.large`
 * при превышении лимита тела, `entity.parse.failed` на битом JSON,
 * `encoding.unsupported` на неизвестной кодировке. Это ошибки ЗАПРОСА, а не
 * сервера.
 *
 * Границы диапазона обе значимы: 5xx от библиотеки — настоящая серверная
 * ошибка и должна дойти до Sentry, а число вне 400..599 (встречается у
 * самодельных ошибок, где `status` — это код домена, а не HTTP) доверия не
 * заслуживает вовсе.
 */
export function clientErrorStatus(err: unknown): number | null {
  const e = err as { status?: unknown; statusCode?: unknown } | null;
  const raw =
    typeof e?.status === "number" ? e.status : typeof e?.statusCode === "number" ? e.statusCode : null;
  return raw !== null && raw >= 400 && raw <= 499 ? raw : null;
}

/** Человеку — размер в тех единицах, в которых он думает о файле. */
function humanBytes(n: number): string {
  if (n >= 1024 * 1024) {
    const mb = n / (1024 * 1024);
    return `${Number.isInteger(mb) ? mb : mb.toFixed(1)} МБ`;
  }
  return `${Math.round(n / 1024)} КБ`;
}

/**
 * Стабильная категория для клиента: без текста библиотеки и без внутренних путей.
 *
 * `requestUrl` нужен, чтобы назвать НАСТОЯЩИЙ предел этого пути. Первая версия
 * писала число прямо в текст — «предел 10 МБ» — и текст соврал в тот же день,
 * когда на проверку чека поставили узкий предел 256 КБ: человек читал неверное
 * число и делал вывод, что дело не в размере. Число теперь берётся из того же
 * источника, что и решение об отказе, поэтому разойтись с ним не может.
 */
export function clientErrorBody(
  err: unknown,
  status: number,
  requestUrl?: string,
): { error: string; message: string } {
  const type = String((err as { type?: unknown } | null)?.type || "");
  if (type === "entity.too.large") {
    const limit = BODY_LIMITS[requestPath(requestUrl)] ?? GLOBAL_BODY_LIMIT_BYTES;
    return {
      error: "payload_too_large",
      message: `Тело запроса больше допустимого. Предел для этого адреса — ${humanBytes(limit)}.`,
    };
  }
  if (type === "entity.parse.failed") {
    return { error: "invalid_json", message: "Тело запроса не разбирается как JSON." };
  }
  if (type === "encoding.unsupported") {
    return { error: "unsupported_encoding", message: "Кодировка тела запроса не поддерживается." };
  }
  return { error: status === 413 ? "payload_too_large" : "bad_request", message: "Запрос отклонён." };
}

/**
 * Ответ на адрес, которого в API нет.
 *
 * Express без такого обработчика отдаёт СВОЮ страницу — HTML с `<!DOCTYPE html>`
 * и заголовком `text/html`. Замер 23.08.2026 на проде: так отвечали все
 * неизвестные адреса, включая `/api/...`. Для API это не косметика: клиент,
 * который делает `await r.json()`, получает не «такого адреса нет», а сбой
 * разбора — то есть отказ маскируется под поломку клиента. Ровно этот класс
 * («нет ответа выглядит как что-то другое») уже стоил нам времени в §16.
 *
 * Обработчик намеренно узкий — только `/api`. Всё, что вне, может быть отдано
 * страницей или статикой, и менять там формат ответа этой правкой незачем.
 *
 * Путь запроса в ответ НЕ возвращается: клиент его и так знает, а отражать
 * пришедшую строку обратно — привычка, которая в других местах уже давала
 * находки. Для разбора хватает строки в журнале.
 */
export function makeApiNotFoundHandler() {
  return function apiNotFound(req: Request, res: Response, next: NextFunction) {
    const url = req.originalUrl ?? req.url;
    if (!url.startsWith("/api")) return next();
    if (res.headersSent) return;
    console.warn(`[express] 404 ${req.method} ${url.slice(0, 200)}`);
    res.status(404).json({
      error: "route_not_found",
      message: "Такого адреса в API нет. Проверьте путь и метод запроса.",
      method: req.method,
    });
  };
}

/**
 * @param capture — куда сообщать о СЕРВЕРНЫХ ошибках. Параметр существует ради
 * теста: иначе «в Sentry не ушло» пришлось бы проверять по строчкам в консоли,
 * то есть по побочному следу, а не по самому действию.
 */
export function makeHttpErrorHandler(capture: typeof captureException = captureException) {
  return function httpErrorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
    const clientStatus = clientErrorStatus(err);
    if (clientStatus !== null) {
      // Коротко и без стека: стек тут — внутренности body-parser, не наш дефект.
      console.warn(
        `[express] ${clientStatus} ${req.method} ${req.originalUrl ?? req.url}: ${String(
          (err as Error)?.message || "",
        ).slice(0, 200)}`,
      );
      if (res.headersSent) return;
      res.status(clientStatus).json(clientErrorBody(err, clientStatus, req.originalUrl ?? req.url));
      return;
    }

    console.error("[express]", err);
    capture(err, {
      url: req.originalUrl ?? req.url,
      method: req.method,
      ip: req.ip,
    });
    if (res.headersSent) return;
    res.status(500).json({ error: "internal_error" });
  };
}
