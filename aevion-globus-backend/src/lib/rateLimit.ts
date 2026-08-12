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

    // req.ip, never the raw X-Forwarded-For header.
    //
    // This used to read the LEFTMOST entry of X-Forwarded-For, and the leftmost
    // entry is whatever the caller wrote: a proxy appends on the right, so the
    // first value is never verified by anything. One header, changed per
    // request, gave every request its own bucket — so every limit built on this
    // helper (120 call sites) counted to one and never fired, including the
    // ones guarding login attempts.
    //
    // Express computes req.ip from the same header but only over the hops the
    // app declares trusted (`app.set("trust proxy", 1)` in index.ts), which
    // makes it the address the front proxy actually observed. With no trust
    // proxy configured it falls back to the socket peer, which is also right.
    const ip = req.ip || req.socket?.remoteAddress || "unknown";
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
