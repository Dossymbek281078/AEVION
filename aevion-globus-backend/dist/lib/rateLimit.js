"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimit = rateLimit;
function defaultKeyFn(req) {
    // express's `req.ip` honours `trust proxy` if configured. Fall back to
    // the raw socket address so localhost dev works without further setup.
    return req.ip || req.socket.remoteAddress || "unknown";
}
function rateLimit(opts) {
    const buckets = new Map();
    const keyFn = opts.keyFn ?? defaultKeyFn;
    const capacity = opts.capacity;
    const refill = opts.refillPerSec;
    return function rateLimitMiddleware(req, res, next) {
        const key = keyFn(req);
        const now = Date.now();
        const existing = buckets.get(key);
        let bucket;
        if (existing) {
            const elapsedSec = (now - existing.updatedAt) / 1000;
            const refilled = Math.min(capacity, existing.tokens + elapsedSec * refill);
            bucket = { tokens: refilled, updatedAt: now };
        }
        else {
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
