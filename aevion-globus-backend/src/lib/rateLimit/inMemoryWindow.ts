import { normalizeAddressForKey } from "../rateLimit";
interface WindowState {
  hits: number[];
}

const WINDOW_MS = 60_000;

export interface RateLimiterOptions {
  max: number;
  windowMs?: number;
}

export function createInMemoryRateLimiter(opts: RateLimiterOptions): {
  check(key: string): { allowed: boolean; retryAfterMs: number };
  reset(): void;
} {
  const windowMs = opts.windowMs ?? WINDOW_MS;
  const state = new Map<string, WindowState>();

  return {
    check(key: string) {
      const now = Date.now();
      const entry = state.get(key) ?? { hits: [] };
      entry.hits = entry.hits.filter((t) => now - t < windowMs);
      if (entry.hits.length >= opts.max) {
        const retryAfterMs = windowMs - (now - entry.hits[0]);
        state.set(key, entry);
        return { allowed: false, retryAfterMs };
      }
      entry.hits.push(now);
      state.set(key, entry);
      return { allowed: true, retryAfterMs: 0 };
    },
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
export function clientIp(req: {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}): string {
  const raw = req.ip || "unknown";
  // ⚠️ 27.08.2026: комментарий выше обещал «то же правило, что clientIp() в
  // lib/rateLimit.ts», и это перестало быть правдой. Там адрес проходит через
  // normalizeAddressForKey (схлопывает IPv6 до /64), здесь возвращался сырым.
  //
  // Следствие практическое: у обычной домашней IPv6-выдачи весь /64 в
  // распоряжении одного человека, и каждый запрос с нового адреса получал
  // СВЕЖЕЕ окно. Ограничители, построенные на этом помощнике, — в том числе
  // 20 регистраций работ в минуту на /api/pipeline/protect — обходились
  // подбором адреса внутри собственной подсети, при этом снаружи выглядели
  // работающими.
  //
  // Правило теперь ОДНО и живёт в одном месте: здесь оно вызывается, а не
  // переписывается заново — третья копия разошлась бы так же, как вторая.
  return raw === "unknown" ? raw : normalizeAddressForKey(raw);
}
