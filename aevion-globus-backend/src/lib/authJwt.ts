import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export type JwtPayload = {
  sub: string;
  email: string;
  role: string;
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

/**
 * Verify a raw token string (e.g. from a WebSocket `?token=` query).
 * Browsers can't set Authorization on WebSocket upgrade — query params are
 * the standard workaround. Returns null on missing/invalid.
 */
export function verifyBearerToken(token: string | null | undefined): JwtPayload | null {
  if (!token) return null;
  try {
    return jwt.verify(token, getJwtSecret()) as JwtPayload;
  } catch {
    return null;
  }
}


/** Express middleware: 401 if no valid Bearer JWT; sets req.auth on success. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const payload = verifyBearerOptional(req);
  if (!payload) {
    res.status(401).json({ error: "authentication required" });
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (req as any).auth = payload;
  next();
}

// Module augmentation so req.auth is available after requireAuth middleware.
declare global {
  namespace Express {
    interface Request {
      auth?: JwtPayload;
    }
  }
}
