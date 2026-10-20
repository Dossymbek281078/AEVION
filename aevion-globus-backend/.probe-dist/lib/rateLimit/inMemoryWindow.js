"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInMemoryRateLimiter = createInMemoryRateLimiter;
exports.clientIp = clientIp;
const rateLimit_1 = require("../rateLimit");
const WINDOW_MS = 60000;
const SWEEP_EVERY_MS = 60000;
function createInMemoryRateLimiter(opts) {
    const windowMs = opts.windowMs ?? WINDOW_MS;
    const state = new Map();
    let lastSweep = 0;
    // Окно в минуту само себя чистит: ключ живёт секунды. Суточное окно так не
    // умеет — карта росла бы весь день на каждый новый адрес. Поэтому раз в
    // минуту выбрасываем ключи, у которых не осталось живых попыток.
    function sweep(now) {
        if (now - lastSweep < SWEEP_EVERY_MS)
            return;
        lastSweep = now;
        for (const [k, v] of state) {
            if (v.hits.every((t) => now - t >= windowMs))
                state.delete(k);
        }
    }
    function verdict(key, consume) {
        const now = Date.now();
        sweep(now);
        const entry = state.get(key) ?? { hits: [] };
        entry.hits = entry.hits.filter((t) => now - t < windowMs);
        if (entry.hits.length >= opts.max) {
            const retryAfterMs = windowMs - (now - entry.hits[0]);
            state.set(key, entry);
            return { allowed: false, retryAfterMs, remaining: 0 };
        }
        if (consume)
            entry.hits.push(now);
        state.set(key, entry);
        return { allowed: true, retryAfterMs: 0, remaining: Math.max(0, opts.max - entry.hits.length) };
    }
    return {
        check: (key) => verdict(key, true),
        peek: (key) => verdict(key, false),
        reset() {
            state.clear();
        },
    };
}
/**
 * The address to count a caller by. Same rule as clientIp() in lib/rateLimit.ts
 * — this is the second copy, kept only because its callers pass a plain
 * `{ ip, headers }` object rather than an express Request.
 *
 * It used to read the LEFTMOST X-Forwarded-For entry. A proxy appends on the
 * right, so the leftmost value is written by the caller and verified by
 * nothing: varying it per request handed every request a fresh window, and the
 * limits built on this helper counted to one forever while looking, from
 * outside, exactly like limits that work.
 *
 * `ip` is req.ip, which express derives from the same header but only across
 * the hops the app declares trusted (`app.set("trust proxy", 1)` in index.ts),
 * so it is the address the front proxy actually observed. The header is not
 * consulted here at all — there is nothing this function could learn from it
 * that req.ip has not already decided more carefully.
 */
function clientIp(req) {
    // Возвращала адрес СЫРЫМ, хотя комментарий рядом утверждал «то же правило,
    // что и clientIp() в lib/rateLimit.ts». Утверждение перестало быть правдой, а
    // проверить его было нечем — две копии одного правила расходились молча.
    //
    // Цена: у обычной домашней раздачи IPv6 весь /64 в распоряжении одного
    // человека, и каждый запрос с нового адреса получал СВЕЖЕЕ окно. Предел
    // «20 регистраций в минуту» на /api/pipeline/protect не ограничивал ничего и
    // снаружи выглядел работающим.
    //
    // Теперь нормализация берётся из ОДНОГО источника, а не переписывается здесь:
    // второй способ решать тот же вопрос сам становится источником расхождения.
    return (0, rateLimit_1.normalizeAddressForKey)(req.ip || "unknown");
}
