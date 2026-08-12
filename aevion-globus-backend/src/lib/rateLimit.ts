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
export function clientIp(req: Request): string {
  return req.ip || req.socket?.remoteAddress || "unknown";
}

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

    const ip = clientIp(req);
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
