import type { Request, Response, NextFunction } from "express";

/**
 * Two shapes, one Map. A key is never shared between shapes: keyPrefix is unique
 * per limiter and a limiter picks its mode once, at construction. The discriminant
 * is there so a stale entry from a hot reload is replaced rather than misread.
 */
type WindowBucket = { kind: "window"; count: number; resetAt: number };
type TokenBucket = { kind: "tokens"; tokens: number; updatedAt: number; capacity: number; refillPerSec: number };
type Bucket = WindowBucket | TokenBucket;

export interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  /** Alias for max — token-bucket style naming used by bank routes. */
  capacity?: number;
  /**
   * Namespace this limiter counts in.
   *
   * Omitting it used to mean "share one bucket with every other limiter that
   * also omitted it" — 6 of the 77 call sites on this helper do, so those 6
   * incremented a single counter per address while each compared it against its
   * own `max`. qsign's verifyLimiter (240/min) and signLimiter (60/min) were two
   * of them: 61 verifies left signing refused for the rest of the minute, and
   * the 429 named a limit that had not been reached. The strictest of the six
   * fared worst — qcoreai's evalRunLimiter (10/min) died once any of the other
   * five had served 10 requests.
   *
   * The default is now unique per limiter instance, so omitting it isolates.
   * Pass the SAME value from two call sites only when you want one shared
   * budget across them.
   *
   * (Most routers use the express-rate-limit package instead of this helper and
   * were never affected — count call sites of THIS module, not every
   * `rateLimit({...})` in src/.)
   */
  keyPrefix?: string;
  message?: string;
  /**
   * Tokens returned per second. Passing it switches this limiter from a fixed
   * window to a token bucket of `capacity` (or `max`) tokens.
   *
   * This used to be an "ignored compat field", which made the three MultiChat
   * limiters that pass it run as fixed windows. The average rate is the same
   * either way; the shape is not, and the shape is the point. A fixed window
   * hands out the whole allowance at once and then refuses for the rest of the
   * window, and it allows 2× the allowance back-to-back across its boundary —
   * 12 at t=59s and 12 more at t=61s. Each of those is a fan-out to up to 8
   * providers on the dispatch endpoint.
   *
   * Ignored (fixed window kept) when not a finite number greater than zero: a
   * value that cannot work must not silently change the mode.
   */
  refillPerSec?: number;
  /**
   * What to count the caller by, when the address is the wrong unit — e.g. a
   * per-account limit that must not make users behind one office NAT share a
   * budget. Return a value that DIFFERS per caller: a constant (or one that
   * collapses every anonymous caller onto the same string) turns a per-caller
   * limit into a global one. Falls back to the address when it returns nothing
   * or throws. Omit it to count by address.
   */
  keyFn?: (req: import("express").Request) => string;
}

/**
 * Нормализация адреса для ключа лимитера.
 *
 * Своей реализации здесь намеренно нет — берём ту же, которой уже пользуются
 * `qpaynet`, `build/public` и `cyberchessTournaments`. Обёртка нужна только
 * ради одного: сбой нормализации не должен ронять запрос. Если она бросит на
 * неожидаемом входе, лимит останется работать по сырому адресу — это хуже
 * нормализованного, но лучше отказа.
 */
export function normalizeAddressForKey(ip: string): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ipKeyGenerator } = require("express-rate-limit") as typeof import("express-rate-limit");
    return ipKeyGenerator(ip) || ip;
  } catch {
    return ip;
  }
}

const GLOBAL_BUCKETS = new Map<string, Bucket>();
let lastSweep = 0;


/**
 * In-process fixed-window rate limiter. No external deps.
 * Serial for the default keyPrefix. Only has to be unique inside the process —
 * the buckets it names live in this module's Map and nothing outside reads the
 * key. Module-load order therefore does not matter.
 */
let limiterSeq = 0;

/**
 * Уже предупреждённые лимитеры: сообщение печатается ОДИН раз на лимитер, а не на
 * каждый запрос. Иначе сломанный keyFn на горячей ручке зальёт лог и его отключат
 * вместе с полезными записями — тревога, которую заглушают, хуже отсутствующей.
 */
const keyFnWarned = new Set<string>();

function warnKeyFnFallback(prefix: string, why: string): void {
  if (keyFnWarned.has(prefix)) return;
  keyFnWarned.add(prefix);
  console.error(
    `[rateLimit] keyFn лимитера "${prefix}" не дал ключа (${why}) — считаю по адресу. ` +
      `Это НЕ то же самое: счёт по аккаунту заменён счётом по адресу, и все за одним ` +
      `NAT снова делят один бюджет. Проверь, разрешён ли req.auth к моменту лимитера.`,
  );
}

/**
 * In-process rate limiter. No external deps. Fixed window by default; a token
 * bucket when the call site passes `refillPerSec`.
 *
 * 🔴 «if the app ever runs on multiple instances» — УЖЕ. Замерено 23.08.2026 на
 * боевом сервисе, не выведено рассуждением:
 *
 *   100 запросов за 11 секунд с одного адреса на `/api/qcoreai/chat`
 *   (объявлено `max: 30` в минуту) → отказов ВСЕГО 2.
 *
 *   Двенадцать ПОСЛЕДОВАТЕЛЬНЫХ запросов, заголовок X-RateLimit-Remaining:
 *   29, 28, 29, 28, 29, 29, 27, 28, 29, 26, 29, 29.
 *
 * Один счётчик давал бы 29, 28, 27, 26… Значит счётчиков несколько: `GLOBAL_BUCKETS`
 * живёт в памяти ПРОЦЕССА, а процессов у сервиса несколько. Заголовок при этом
 * честен — врёт не он, а наше прочтение `max` как «предела платформы».
 *
 * Что это значит на практике: настоящий предел примерно вчетверо выше
 * объявленного и зависит от числа процессов, то есть меняется при масштабировании
 * молча. Пока лимитер стоит перед бесплатной ручкой — терпимо. Перед ручкой,
 * которая тратит деньги (платный ИИ), — нет, и там нужна граница, не зависящая
 * от числа процессов: см. `aiInputBudget.ts`, он ограничивает цену ОДНОГО вызова.
 *
 * Настоящая починка — общий счётчик (Redis/Postgres). Она не сделана намеренно:
 * это работа, которую нельзя проверить иначе как на проде, а до запуска 30.08
 * сломанный ограничитель, отказывающий живым людям, хуже слабого.
 */
/**
 * Адрес клиента как КЛЮЧ ограничителя.
 *
 * Возвращён 19.08.2026 при объединении веток: пять шахматных модулей зовут эту
 * функцию, а в версии из ветки прода её не было — проверка типов поймала это
 * до выкатки. Восстановлена поверх ИХ файла, а не заменой файла целиком: там
 * живёт нормализация адреса, закрывающая обход ограничителя по IPv6.
 *
 * Почему НЕ читаем X-Forwarded-For напрямую (объяснение из удалённой копии,
 * оно отвечает на другой вопрос и потерять его нельзя): прокси дописывает
 * себя справа, поэтому ЛЕВЫЙ элемент — тот, что берёт `split(",")[0]`, —
 * пишет сам клиент, и его никто не проверяет. Ограничитель по такому ключу
 * даёт каждому запросу свою корзину, как только клиент меняет заголовок:
 * снаружи он выглядит работающим и не срабатывает никогда. `req.ip` читает
 * тот же заголовок, но только по узлам, которые приложение объявило
 * доверенными (`app.set("trust proxy", 1)`).
 *
 * Нормализуем тем же helper-ом, что и сам ограничитель. Иначе один и тот же
 * человек получал бы РАЗНЫЕ корзины в шахматах и в остальной платформе — а
 * это и есть обход: две записи одного адреса считаются двумя посетителями.
 */
/**
 * ВЗЯТО ЦЕЛИКОМ из ветки fix/build-closed-vacancy-feed (коммит d9cc19ce0 от
 * 28.07.2026), а не написано заново: там эта функция уже стоит на 27 дорогих
 * ручках, и второй способ ограничивать те же вызовы разошёлся бы с первым на
 * первом же краевом случае. Ветка ждёт мержа; когда он случится, эта копия и
 * тамошний оригинал совпадут дословно.
 *
 * Оговорка, которой у оригинала не было: счётчик живёт в памяти ПРОЦЕССА, а
 * процессов у сервиса несколько (замер 23.08: 100 запросов за 11 с при пределе
 * 30 дали 2 отказа). Настоящий предел примерно вчетверо выше объявленного.
 * Поэтому у платных ручек рядом обязана стоять граница ЦЕНЫ одного вызова —
 * см. aiInputBudget.ts, она от числа процессов не зависит.
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


export function clientIp(req: { ip?: string; socket?: { remoteAddress?: string } }): string {
  const raw = req.ip || req.socket?.remoteAddress || "unknown";
  return raw === "unknown" ? raw : normalizeAddressForKey(raw);
}

export function rateLimit(opts: RateLimitOptions) {
  const windowMs = opts.windowMs ?? 60_000;
  const max = opts.max ?? opts.capacity ?? 60;
  const { message = "Too many requests", keyFn } = opts;
  // Unique per instance, not the shared "rl" this used to default to.
  const keyPrefix = opts.keyPrefix ?? `rl#${++limiterSeq}`;
  const refillPerSec =
    typeof opts.refillPerSec === "number" && Number.isFinite(opts.refillPerSec) && opts.refillPerSec > 0
      ? opts.refillPerSec
      : null;

  return function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
    const now = Date.now();
    if (now - lastSweep > 60_000) {
      lastSweep = now;
      for (const [k, b] of GLOBAL_BUCKETS) {
        const spent =
          b.kind === "window"
            ? b.resetAt <= now
            : // A full bucket carries no state worth keeping.
              b.tokens + ((now - b.updatedAt) / 1000) * b.refillPerSec >= b.capacity;
        if (spent) GLOBAL_BUCKETS.delete(k);
      }
    }

    // Адрес берётся у соседней починки: clientIp читает заголовок прокси
    // только по доверенным узлам, поэтому подделать его нельзя.
    // Как сводить это место, прошлая сессия написала прямо здесь: их получение
    // адреса + моё построение ключа. Взять только одно — вернуть либо
    // подделываемый заголовок, либо общий счётчик на шесть лимитеров.
    const ip = clientIp(req);
    // A keyFn from the call site names the unit to count (an account, a tenant);
    // the address is the fallback, including when the fn yields nothing usable.
    let counted = ip;
    if (keyFn) {
      try {
        const named = keyFn(req);
        if (typeof named === "string" && named.trim()) counted = named.trim();
        else warnKeyFnFallback(keyPrefix, "вернул не строку или пусто");
      } catch (err) {
        // Лимитер не должен быть причиной отказа запроса — считаем по адресу.
        // Но МОЛЧА этого делать нельзя: подмена единицы счёта незаметно
        // возвращает тот самый дефект, ради которого keyFn и появился. Пример:
        // multichat считает по аккаунту, keyFn падает — и все, кто за одним
        // адресом, снова делят один бюджет. Ни отказа, ни следа в логах.
        warnKeyFnFallback(keyPrefix, String((err as Error)?.message || err).slice(0, 120));
      }
    }
    // Адрес в ключе — нормализованный, иначе IPv6-клиент обходит любой лимит
    // по адресу, просто меняя адрес: провайдер выдаёт клиенту целый префикс
    // (/64), то есть 18 квинтиллионов адресов, и каждый давал бы свой счётчик.
    //
    // Нормализация берётся из `express-rate-limit`, а не пишется своя: пакет уже
    // в зависимостях, три файла бэкенда (`qpaynet`, `build/public`,
    // `cyberchessTournaments`) нормализуют именно им, и второй способ делать то
    // же самое разошёлся бы с первым на первом же краевом случае. Проверено:
    // два адреса из одного префикса дают один ключ, `::ffff:127.0.0.1`
    // разворачивается в `127.0.0.1`, а «unknown» и пустая строка проходят без
    // исключения.
    //
    // На аккаунтные ключи (из keyFn) нормализация НЕ распространяется — там в
    // ключе не адрес, и трогать его нечем.
    const key = `${keyPrefix}:${counted === ip ? normalizeAddressForKey(ip) : counted}`;

    const existing = GLOBAL_BUCKETS.get(key);

    if (refillPerSec !== null) {
      let b = existing?.kind === "tokens" ? existing : undefined;
      if (!b) {
        b = { kind: "tokens", tokens: max, updatedAt: now, capacity: max, refillPerSec };
        GLOBAL_BUCKETS.set(key, b);
      }
      // Accrue first, then decide. Capped at capacity so idle time can't bank a
      // burst larger than the bucket.
      b.tokens = Math.min(b.capacity, b.tokens + ((now - b.updatedAt) / 1000) * refillPerSec);
      b.updatedAt = now;

      const allowed = b.tokens >= 1;
      if (allowed) b.tokens -= 1;

      res.setHeader("X-RateLimit-Limit", String(b.capacity));
      // Floor for display only — the decision above uses the exact value.
      res.setHeader("X-RateLimit-Remaining", String(Math.max(0, Math.floor(b.tokens))));
      const secsToFull = (b.capacity - b.tokens) / refillPerSec;
      res.setHeader("X-RateLimit-Reset", String(Math.ceil(now / 1000 + secsToFull)));

      if (!allowed) {
        const retryAfter = Math.max(1, Math.ceil((1 - b.tokens) / refillPerSec));
        res.setHeader("Retry-After", String(retryAfter));
        return res.status(429).json({ error: message, retryAfterSec: retryAfter });
      }
      return next();
    }

    let bucket = existing?.kind === "window" ? existing : undefined;
    if (!bucket || bucket.resetAt <= now) {
      bucket = { kind: "window", count: 0, resetAt: now + windowMs };
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
