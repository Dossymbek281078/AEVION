import type { Request } from "express";
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
