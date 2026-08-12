import type { Request, Response, NextFunction } from "express";

type Bucket = { count: number; resetAt: number };

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
  /** Ignored compat field from bank token-bucket API. */
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

const GLOBAL_BUCKETS = new Map<string, Bucket>();
let lastSweep = 0;

/**
 * Serial for the default keyPrefix. Only has to be unique inside the process —
 * the buckets it names live in this module's Map and nothing outside reads the
 * key. Module-load order therefore does not matter.
 */
let limiterSeq = 0;

/**
 * In-process fixed-window rate limiter. No external deps.
 * Good enough for public read-only endpoints; replace with Redis-backed
 * limiter if the app ever runs on multiple instances.
 */
export function rateLimit(opts: RateLimitOptions) {
  const windowMs = opts.windowMs ?? 60_000;
  const max = opts.max ?? opts.capacity ?? 60;
  const { message = "Too many requests", keyFn } = opts;
  // Unique per instance, not the shared "rl" this used to default to.
  const keyPrefix = opts.keyPrefix ?? `rl#${++limiterSeq}`;

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
    // A keyFn from the call site names the unit to count (an account, a tenant);
    // the address is the fallback, including when the fn yields nothing usable.
    let counted = ip;
    if (keyFn) {
      try {
        const named = keyFn(req);
        if (typeof named === "string" && named.trim()) counted = named.trim();
      } catch {
        // A limiter must not be the reason a request fails. Count by address.
      }
    }
    const key = `${keyPrefix}:${counted}`;

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
