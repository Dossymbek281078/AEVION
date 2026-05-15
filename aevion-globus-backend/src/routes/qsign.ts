import { Router, type Request, type Response, type NextFunction } from "express";
import crypto from "crypto";
import { rateLimit } from "../lib/rateLimit";
import { getQSignSecret } from "../lib/qsignSecret";

export const qsignRouter = Router();

/**
 * QSign v1 — legacy HMAC-SHA256 signing API.
 *
 * Production traffic should migrate to /api/qsign/v2 which has canonicalization,
 * rotatable keys, audit log, Ed25519 + ML-DSA-65, and structured webhooks.
 *
 * v1 is kept alive because the bank smoke page (frontend/src/app/bank/smoke/page.tsx)
 * and the public API pricing page (frontend/src/app/bank/api/page.tsx) still
 * reference these paths. New integrations MUST use v2.
 */

// QSign secret resolution moved to lib/qsignSecret.ts so planetCompliance and
// other call sites share the same fail-closed gate.

const MAX_PAYLOAD_BYTES = 256 * 1024; // 256 KB — enough for invoices/receipts

function signPayload(payload: unknown): string {
  const raw = JSON.stringify(payload);
  if (raw.length > MAX_PAYLOAD_BYTES) {
    throw new Error(`payload too large (max ${MAX_PAYLOAD_BYTES} bytes)`);
  }
  return crypto.createHmac("sha256", getQSignSecret()).update(raw).digest("hex");
}

/**
 * Constant-time equality for hex strings of equal length. Falls back to false
 * on length mismatch (timingSafeEqual itself throws on mismatch). Prevents
 * the trivial timing oracle that `===` exposes.
 */
function timingSafeEqHex(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

const signLimiter = rateLimit({ windowMs: 60_000, max: 60 });
const verifyLimiter = rateLimit({ windowMs: 60_000, max: 240 });

function deprecation(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader("Deprecation", "true");
  res.setHeader("Link", '</api/qsign/v2/openapi.json>; rel="successor-version"');
  res.setHeader("Sunset", "2026-12-31");
  next();
}

qsignRouter.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "qsign-legacy",
    note: "v1 HMAC stub; production traffic should use /api/qsign/v2",
    deprecated: true,
    sunset: "2026-12-31",
    timestamp: new Date().toISOString(),
  });
});

qsignRouter.post(
  "/sign",
  signLimiter as unknown as (req: Request, res: Response, next: NextFunction) => void,
  deprecation,
  (req, res) => {
    try {
      const payload = req.body;
      if (payload === undefined || payload === null) {
        return res.status(400).json({ error: "payload is required" });
      }
      const signature = signPayload(payload);
      res.json({
        payload,
        signature,
        algo: "HMAC-SHA256",
        createdAt: new Date().toISOString(),
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "sign_failed";
      const code = msg.startsWith("QSIGN_SECRET") ? 500 : 400;
      res.status(code).json({ error: msg });
    }
  },
);

qsignRouter.post(
  "/verify",
  verifyLimiter as unknown as (req: Request, res: Response, next: NextFunction) => void,
  deprecation,
  (req, res) => {
    try {
      const { payload, signature } = req.body || {};
      if (!payload || typeof signature !== "string" || !signature) {
        return res.status(400).json({ error: "payload and signature are required" });
      }
      const expected = signPayload(payload);
      const valid = timingSafeEqHex(expected, signature);
      // Never echo `expected` — that's a forgery oracle. Just yes/no + algo.
      res.json({ valid, algo: "HMAC-SHA256" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "verify_failed";
      const code = msg.startsWith("QSIGN_SECRET") ? 500 : 400;
      res.status(code).json({ error: msg });
    }
  },
);
