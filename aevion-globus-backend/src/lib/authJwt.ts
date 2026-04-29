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
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "missing bearer token" });
    return;
  }
  try {
    req.auth = jwt.verify(token, getJwtSecret()) as JwtPayload;
    next();
  } catch (e: unknown) {
    res.status(401).json({
      error: "invalid token",
      details: e instanceof Error ? e.message : String(e),
    });
  }
}
