import type { Request, Response, NextFunction } from "express";

import { captureException } from "./sentry";

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

/** Стабильная категория для клиента: без текста библиотеки и без внутренних путей. */
export function clientErrorBody(err: unknown, status: number): { error: string; message: string } {
  const type = String((err as { type?: unknown } | null)?.type || "");
  if (type === "entity.too.large") {
    return {
      error: "payload_too_large",
      message: "Тело запроса больше допустимого. Для чека мультичата предел — 10 МБ.",
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
      res.status(clientStatus).json(clientErrorBody(err, clientStatus));
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
