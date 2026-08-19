"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeAddressForKey = normalizeAddressForKey;
exports.clientIp = clientIp;
exports.rateLimit = rateLimit;
/**
 * Нормализация адреса для ключа лимитера.
 *
 * Своей реализации здесь намеренно нет — берём ту же, которой уже пользуются
 * `qpaynet`, `build/public` и `cyberchessTournaments`. Обёртка нужна только
 * ради одного: сбой нормализации не должен ронять запрос. Если она бросит на
 * неожидаемом входе, лимит останется работать по сырому адресу — это хуже
 * нормализованного, но лучше отказа.
 */
function normalizeAddressForKey(ip) {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { ipKeyGenerator } = require("express-rate-limit");
        return ipKeyGenerator(ip) || ip;
    }
    catch {
        return ip;
    }
}
const GLOBAL_BUCKETS = new Map();
let lastSweep = 0;
/**
 * The address to count a caller by.
 *
 * Never read X-Forwarded-For directly. A proxy appends on the right, so the
 * LEFTMOST entry — the one a `split(",")[0]` picks — is whatever the caller
 * wrote and nothing verifies it. Keying a limit on it gives every request its
 * own bucket the moment the caller varies the header, which is a limit that
 * cannot fire while looking from the outside exactly like one that works.
 *
 * req.ip reads the same header, but only across the hops the app declares
 * trusted (`app.set("trust proxy", 1)` in index.ts), so it is the address the
 * front proxy actually observed. With no trust proxy configured it falls back
 * to the socket peer, which is also right.
 */
function clientIp(req) {
    return req.ip || req.socket?.remoteAddress || "unknown";
}
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
const keyFnWarned = new Set();
function warnKeyFnFallback(prefix, why) {
    if (keyFnWarned.has(prefix))
        return;
    keyFnWarned.add(prefix);
    console.error(`[rateLimit] keyFn лимитера "${prefix}" не дал ключа (${why}) — считаю по адресу. ` +
        `Это НЕ то же самое: счёт по аккаунту заменён счётом по адресу, и все за одним ` +
        `NAT снова делят один бюджет. Проверь, разрешён ли req.auth к моменту лимитера.`);
}
/**
 * In-process rate limiter. No external deps. Fixed window by default; a token
 * bucket when the call site passes `refillPerSec`.
 * Good enough for public read-only endpoints; replace with Redis-backed
 * limiter if the app ever runs on multiple instances.
 */
function rateLimit(opts) {
    const windowMs = opts.windowMs ?? 60000;
    const max = opts.max ?? opts.capacity ?? 60;
    const { message = "Too many requests", keyFn } = opts;
    // Unique per instance, not the shared "rl" this used to default to.
    const keyPrefix = opts.keyPrefix ?? `rl#${++limiterSeq}`;
    const refillPerSec = typeof opts.refillPerSec === "number" && Number.isFinite(opts.refillPerSec) && opts.refillPerSec > 0
        ? opts.refillPerSec
        : null;
    return function rateLimitMiddleware(req, res, next) {
        const now = Date.now();
        if (now - lastSweep > 60000) {
            lastSweep = now;
            for (const [k, b] of GLOBAL_BUCKETS) {
                const spent = b.kind === "window"
                    ? b.resetAt <= now
                    : // A full bucket carries no state worth keeping.
                        b.tokens + ((now - b.updatedAt) / 1000) * b.refillPerSec >= b.capacity;
                if (spent)
                    GLOBAL_BUCKETS.delete(k);
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
                if (typeof named === "string" && named.trim())
                    counted = named.trim();
                else
                    warnKeyFnFallback(keyPrefix, "вернул не строку или пусто");
            }
            catch (err) {
                // Лимитер не должен быть причиной отказа запроса — считаем по адресу.
                // Но МОЛЧА этого делать нельзя: подмена единицы счёта незаметно
                // возвращает тот самый дефект, ради которого keyFn и появился. Пример:
                // multichat считает по аккаунту, keyFn падает — и все, кто за одним
                // адресом, снова делят один бюджет. Ни отказа, ни следа в логах.
                warnKeyFnFallback(keyPrefix, String(err?.message || err).slice(0, 120));
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
            if (allowed)
                b.tokens -= 1;
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
