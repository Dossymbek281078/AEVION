import type { Request, Response, NextFunction } from "express";

type Bucket = { tokens: number; updatedAt: number };

/** Token-bucket style: capacity + refillPerSec. */
type TokenBucketOptions = {
  capacity: number;
  refillPerSec: number;
  keyFn?: (req: Request) => string;
  keyPrefix?: string;
};

/** express-rate-limit compatible: windowMs + max. Converted to token bucket internally. */
type WindowOptions = {
  windowMs: number;
  max: number;
  keyFn?: (req: Request) => string;
  keyPrefix?: string;
  message?: string;
};

export type RateLimitOptions = TokenBucketOptions | WindowOptions;

function isWindowOpts(o: RateLimitOptions): o is WindowOptions {
  return "windowMs" in o;
}

function defaultKeyFn(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}

export function rateLimit(opts: RateLimitOptions) {
  const buckets = new Map<string, Bucket>();
  const keyFn = opts.keyFn ?? defaultKeyFn;
  const prefix = opts.keyPrefix ?? "";

  let capacity: number;
  let refill: number;
  if (isWindowOpts(opts)) {
    capacity = opts.max;
    refill = opts.max / (opts.windowMs / 1000);
  } else {
    capacity = opts.capacity;
    refill = opts.refillPerSec;
  }

  return function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
    const key = prefix + keyFn(req);
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
      res.status(429).json({ error: "rate limit exceeded", retryAfterSeconds: retryAfter });
      return;
    }

    bucket.tokens -= 1;
    buckets.set(key, bucket);
    next();
  };
}
