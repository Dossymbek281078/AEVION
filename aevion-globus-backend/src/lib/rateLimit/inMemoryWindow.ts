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
