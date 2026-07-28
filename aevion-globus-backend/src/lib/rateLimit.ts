import type { Request, Response, NextFunction } from "express";

type Bucket = { count: number; resetAt: number };

export interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  /** Alias for max — token-bucket style naming used by bank routes. */
  capacity?: number;
  keyPrefix?: string;
  message?: string;
  /** Ignored compat field from bank token-bucket API. */
  refillPerSec?: number;
  /** Ignored compat field — per-request key customisation not supported in this impl. */
  keyFn?: (req: import("express").Request) => string;
}

const GLOBAL_BUCKETS = new Map<string, Bucket>();
let lastSweep = 0;

/**
 * In-process fixed-window rate limiter. No external deps.
 * Good enough for public read-only endpoints; replace with Redis-backed
 * limiter if the app ever runs on multiple instances.
 */
export function rateLimit(opts: RateLimitOptions) {
  const windowMs = opts.windowMs ?? 60_000;
  const max = opts.max ?? opts.capacity ?? 60;
  const { keyPrefix = "rl", message = "Too many requests" } = opts;

  return function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
    const now = Date.now();
    if (now - lastSweep > 60_000) {
      lastSweep = now;
      for (const [k, b] of GLOBAL_BUCKETS) {
        if (b.resetAt <= now) GLOBAL_BUCKETS.delete(k);
      }
    }

    const ip =
      (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
      req.ip ||
      req.socket?.remoteAddress ||
      "unknown";
    const key = `${keyPrefix}:${ip}`;

    let bucket = GLOBAL_BUCKETS.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      GLOBAL_BUCKETS.set(key, bucket);
    }
    bucket.count += 1;

    const remaining = Math.max(0, max - bucket.count);
    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(remaining));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > max) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({ error: message, retryAfterSec: retryAfter });
    }

    next();
  };
}

/**
 * Ограничитель для ручек, которые ЗОВУТ ПЛАТНОГО ПРОВАЙДЕРА.
 *
 * Замер 28.07: из 53 ручек, обращающихся к OpenAI / Anthropic / Replicate /
 * ElevenLabs / DeepL / Brevo, у 26 не было НИЧЕГО — ни ограничителя, ни квоты по
 * кредитам, ни платной стены. Стену при этом легко принять за защиту: в коде
 * `requireModule()` висит на многих префиксах, но он спящий и работает только для
 * модулей из env `PAYWALL_MODULES`. Опрос прода показал, что включена она ровно
 * для шести, и QCoreAI в их число не входит.
 *
 * Это НЕ квота и НЕ тариф: лимит не различает пользователей и ничего не продаёт.
 * Его задача — чтобы перебор в цикле не превращался в счёт от провайдера. Поэтому
 * порог намеренно щедрый: 30 вызовов в минуту с адреса далеко за пределами
 * человеческой работы, но останавливает скрипт.
 *
 * Число меняется переменной `GENERATION_RATE_LIMIT` без правки кода — ужесточить
 * можно из Railway, не дожидаясь релиза.
 *
 * Порог 30, а не 20: у существующих тестов до 19 обращений к одной ручке
 * (`/media/email`), и лимит 20 не оставлял бы запаса — новый тест ломался бы, а
 * выглядело бы это как дефект продукта.
 */
export function generationLimit(keyPrefix: string) {
  const raw = Number(process.env.GENERATION_RATE_LIMIT);
  const max = Number.isFinite(raw) && raw > 0 ? raw : 30;
  return rateLimit({
    windowMs: 60_000,
    max,
    keyPrefix,
    message: "Слишком много запросов к генерации. Подождите минуту.",
  });
}
