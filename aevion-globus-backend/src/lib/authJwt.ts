import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

declare global {
  namespace Express {
    interface Request {
      auth?: import("./authJwt").JwtPayload;
    }
  }
}

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
  const secret = process.env.AUTH_JWT_SECRET;
  // In production we refuse to issue or verify with a default/dev secret —
  // anything else lets anyone with the OSS code forge tokens.
  if (process.env.NODE_ENV === "production") {
    if (!secret || secret.length < 32 || secret.startsWith("dev-")) {
      throw new Error(
        "AUTH_JWT_SECRET is missing or weak in production — refusing to mint/verify JWTs",
      );
    }
    return secret;
  }
  return secret || "dev-auth-secret";
}

/** Returns payload or null if missing/invalid token (no HTTP response). */
export function verifyBearerOptional(req: Request): JwtPayload | null {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  try {
    return jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] }) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Verify a raw token string (e.g. from a WebSocket `?token=` query).
 * Browsers can't set Authorization on WebSocket upgrade — query params are
 * the standard workaround. Returns null on missing/invalid.
 */
export function verifyBearerToken(token: string | null | undefined): JwtPayload | null {
  if (!token) return null;
  try {
    return jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] }) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Express middleware — rejects unauthenticated requests with 401.
 * On success attaches the JWT payload as `(req as any).auth`.
 * Used by bank-track routes that require a signed-in user.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const payload = verifyBearerOptional(req);
  if (!payload) {
    res.status(401).json({ error: "auth required" });
    return;
  }
  (req as any).auth = payload;
  next();
}
