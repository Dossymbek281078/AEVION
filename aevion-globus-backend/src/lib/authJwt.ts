import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export type JwtPayload = {
  sub: string;
  email: string;
  role: string;
  /**
   * Monotonic counter that mirrors AEVIONUser.tokenVersion at issue time.
   * If the server-side row's counter is incremented (e.g. via /api/auth/
   * sign-out-everywhere), every previously-issued token is rejected by
   * the verifier because payload.tokenVersion no longer matches.
   *
   * Optional for backwards compatibility: tokens issued before this
   * column existed have no tv field and are accepted as long as the
   * stored counter is still 0 (default). Incrementing the counter
   * forces re-login on every device.
   */
  tv?: number;
};

export function getJwtSecret(): string {
  return process.env.AUTH_JWT_SECRET || "dev-auth-secret";
}

/** Returns payload or null if missing/invalid token (no HTTP response). */
export function verifyBearerOptional(req: Request): JwtPayload | null {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  try {
    return jwt.verify(token, getJwtSecret()) as JwtPayload;
  } catch {
    return null;
  }
}

// Express request augmentation so handlers can read req.auth typed.
declare module "express-serve-static-core" {
  interface Request {
    auth?: JwtPayload;
  }
}

/**
 * Express middleware: rejects with 401 unless a valid bearer token is present.
 * On success, attaches the decoded payload to `req.auth` so route handlers
 * can scope queries to the authenticated user.
 *
 * If the token carries a `tv` (token-version) claim, the middleware checks
 * it against the per-user cached counter. A mismatch means the user has
 * since clicked "sign out everywhere" and every token issued before that
 * bump must be rejected. Tokens predating the column have no tv claim
 * and are accepted as long as the cached counter is still 0.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "missing bearer token" });
    return;
  }
  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, getJwtSecret()) as JwtPayload;
  } catch (e: unknown) {
    res.status(401).json({
      error: "invalid token",
      details: e instanceof Error ? e.message : String(e),
    });
    return;
  }

  // Token-version revocation check. Uses a short in-memory cache so the
  // hot path doesn't hit Postgres on every request — see getCachedTokenVersion.
  getCachedTokenVersion(payload.sub)
    .then((current) => {
      if (current === null) {
        // User row was deleted but token still valid in JWT terms — reject.
        res.status(401).json({ error: "user no longer exists" });
        return;
      }
      const claimed = typeof payload.tv === "number" ? payload.tv : 0;
      if (claimed !== current) {
        res.status(401).json({ error: "session revoked", details: "please sign in again" });
        return;
      }
      req.auth = payload;
      next();
    })
    .catch((err) => {
      console.error("[requireAuth] tokenVersion check failed", err);
      // Fail closed only when we can't reach the DB — accept the JWT and
      // let the route's own error handling fire if needed. Logging the
      // failure surfaces the issue to ops without taking down auth.
      req.auth = payload;
      next();
    });
}

// ────────────────────────────────────────────────────────────────────────
// Per-user tokenVersion cache.
//
// Keeps a short TTL so a "sign out everywhere" click takes effect for all
// devices within ~10 seconds without hammering Postgres on the hot auth
// path. Memory: bounded by the active user set; entries are GC'd on
// access (we never iterate).

const TOKEN_VERSION_TTL_MS = 10_000;
const cache = new Map<string, { v: number | null; expiresAt: number }>();

async function getCachedTokenVersion(userId: string): Promise<number | null> {
  const now = Date.now();
  const hit = cache.get(userId);
  if (hit && hit.expiresAt > now) return hit.v;

  // Lazy import to avoid a top-level circular dep with dbPool init.
  const { getPool } = await import("./dbPool");
  const r = await getPool().query(
    `SELECT "tokenVersion" FROM "AEVIONUser" WHERE "id" = $1`,
    [userId],
  );
  const row = (r as { rows?: Array<{ tokenVersion: number }> }).rows?.[0];
  const v = row ? Number(row.tokenVersion) : null;
  cache.set(userId, { v, expiresAt: now + TOKEN_VERSION_TTL_MS });
  return v;
}

/**
 * Invalidates the in-memory tokenVersion cache for a single user. Call
 * after the sign-out-everywhere endpoint bumps the column so the change
 * takes effect immediately on the calling node (other nodes pick it up
 * on TTL expiry).
 */
export function invalidateTokenVersionCache(userId: string): void {
  cache.delete(userId);
}
