interface WindowState {
  hits: number[];
}

const WINDOW_MS = 60_000;

export interface RateLimiterOptions {
  max: number;
  windowMs?: number;
}

export interface WindowVerdict {
  allowed: boolean;
  retryAfterMs: number;
  /** Сколько попыток осталось в окне после этого ответа. */
  remaining: number;
}

const SWEEP_EVERY_MS = 60_000;

export function createInMemoryRateLimiter(opts: RateLimiterOptions): {
  check(key: string): WindowVerdict;
  /** Тот же вердикт, но без расхода попытки — для «сначала спроси, потом трать». */
  peek(key: string): WindowVerdict;
  reset(): void;
} {
  const windowMs = opts.windowMs ?? WINDOW_MS;
  const state = new Map<string, WindowState>();
  let lastSweep = 0;

  // Окно в минуту само себя чистит: ключ живёт секунды. Суточное окно так не
  // умеет — карта росла бы весь день на каждый новый адрес. Поэтому раз в
  // минуту выбрасываем ключи, у которых не осталось живых попыток.
  function sweep(now: number) {
    if (now - lastSweep < SWEEP_EVERY_MS) return;
    lastSweep = now;
    for (const [k, v] of state) {
      if (v.hits.every((t) => now - t >= windowMs)) state.delete(k);
    }
  }

  function verdict(key: string, consume: boolean): WindowVerdict {
    const now = Date.now();
    sweep(now);
    const entry = state.get(key) ?? { hits: [] };
    entry.hits = entry.hits.filter((t) => now - t < windowMs);
    if (entry.hits.length >= opts.max) {
      const retryAfterMs = windowMs - (now - entry.hits[0]);
      state.set(key, entry);
      return { allowed: false, retryAfterMs, remaining: 0 };
    }
    if (consume) entry.hits.push(now);
    state.set(key, entry);
    return { allowed: true, retryAfterMs: 0, remaining: Math.max(0, opts.max - entry.hits.length) };
  }

  return {
    check: (key: string) => verdict(key, true),
    peek: (key: string) => verdict(key, false),
    reset() {
      state.clear();
    },
  };
}

export function clientIp(req: {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}): string {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.length > 0) {
    return xf.split(",")[0].trim();
  }
  if (Array.isArray(xf) && xf.length > 0) {
    return xf[0].split(",")[0].trim();
  }
  return req.ip || "unknown";
}
