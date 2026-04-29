import type { Request, Response, NextFunction } from "express";

// Tiny in-memory token bucket per source key (IP, email, or whatever the
// caller chooses to key on). Designed for low-traffic endpoints like
// /api/auth/register where one process suffices and a real Redis-backed
// limiter is overkill until the service scales horizontally.
//
// Each bucket holds up to `capacity` tokens and refills at `refillPerSec`
// tokens/second. A request consumes 1 token; if the bucket is empty the
// limiter responds 429 with `Retry-After` (seconds, integer).
//
// Memory: bucket entries are GC'd lazily on access (we never iterate),
// keeping the map roughly proportional to the active concurrent client set.

type Bucket = { tokens: number; updatedAt: number };

export type RateLimitOptions = {
  capacity: number;
  refillPerSec: number;
  keyFn?: (req: Request) => string;
};

function defaultKeyFn(req: Request): string {
  // express's `req.ip` honours `trust proxy` if configured. Fall back to
  // the raw socket address so localhost dev works without further setup.
  return req.ip || req.socket.remoteAddress || "unknown";
}

export function rateLimit(opts: RateLimitOptions) {
  const buckets = new Map<string, Bucket>();
  const keyFn = opts.keyFn ?? defaultKeyFn;
  const capacity = opts.capacity;
  const refill = opts.refillPerSec;

  return function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
    const key = keyFn(req);
    const now = Date.now();
    const existing = buckets.get(key);
    let bucket: Bucket;
    if (existing) {
      const elapsedSec = (now - existing.updatedAt) / 1000;
      const refilled = Math.min(capacity, existing.tokens + elapsedSec * refill);
      bucket = { tokens: refilled, updatedAt: now };
    } else {
      bucket = { tokens: capacity, updatedAt: now };
    }

    if (bucket.tokens < 1) {
      const need = 1 - bucket.tokens;
      const retryAfter = Math.max(1, Math.ceil(need / refill));
      buckets.set(key, bucket);
      res.setHeader("Retry-After", String(retryAfter));
      res.status(429).json({
        error: "rate limit exceeded",
        retryAfterSeconds: retryAfter,
      });
      return;
    }

    bucket.tokens -= 1;
    buckets.set(key, bucket);
    next();
  };
}
