/**
 * @aevion/qsign-webhook-receiver — drop-in HMAC verifier for QSign v2 webhook
 * deliveries. Pure function + Express middleware.
 *
 * Why: QSign signs every webhook body with HMAC-SHA256(secret, raw-bytes) and
 * delivers it via the `X-QSign-Signature` header. Receivers MUST verify
 * before trusting the body — otherwise an attacker could forge "sign" /
 * "revoke" events and confuse the consumer.
 *
 * Zero dependencies. Uses Node's built-in `crypto`.
 */

import { createHmac, timingSafeEqual } from "crypto";

export type QSignWebhookEvent = "sign" | "revoke";

export type QSignWebhookBody = {
  event: QSignWebhookEvent;
  timestamp: string;
  data: Record<string, unknown>;
};

/**
 * Verifies the `X-QSign-Signature` header against the raw request body.
 * Constant-time, length-checked, hex-only — safe to expose to untrusted
 * input. Returns true iff the HMAC matches.
 *
 * Important: pass the **raw** body bytes (Buffer or UTF-8 string), NOT the
 * parsed JSON object. JSON.stringify(body) round-tripping will not match
 * the bytes the server signed.
 *
 *   const ok = verifyQSignWebhookSignature(
 *     req.rawBody,
 *     req.headers["x-qsign-signature"],
 *     process.env.QSIGN_WEBHOOK_SECRET,
 *   );
 */
export function verifyQSignWebhookSignature(
  rawBody: Buffer | string,
  signatureHeader: string | string[] | undefined,
  secret: string,
): boolean {
  if (!secret || typeof secret !== "string") return false;
  if (!signatureHeader || Array.isArray(signatureHeader)) return false;
  if (!/^[0-9a-fA-F]{64}$/.test(signatureHeader)) return false;

  const bodyBuf =
    typeof rawBody === "string" ? Buffer.from(rawBody, "utf8") : rawBody;
  if (!Buffer.isBuffer(bodyBuf)) return false;

  const expected = createHmac("sha256", secret).update(bodyBuf).digest("hex");

  // Both sides are 64-char lowercase hex once we normalize; convert and
  // compare in constant time.
  const expectedBuf = Buffer.from(expected, "hex");
  const gotBuf = Buffer.from(signatureHeader.toLowerCase(), "hex");
  if (expectedBuf.length !== gotBuf.length) return false;
  try {
    return timingSafeEqual(expectedBuf, gotBuf);
  } catch {
    return false;
  }
}

/* ───────── Express middleware ─────────
 * Drop-in: requires a way to capture the raw body. The cleanest way is
 * `express.json({ verify: ... })` so we can read both parsed body and raw
 * bytes without re-buffering.
 *
 * Mount sequence:
 *
 *   import express from "express";
 *   import { qsignWebhookMiddleware } from "@aevion/qsign-webhook-receiver";
 *
 *   const app = express();
 *
 *   app.post(
 *     "/qsign-webhook",
 *     express.json({
 *       verify: (req, _res, buf) => { (req as any).rawBody = buf; },
 *     }),
 *     qsignWebhookMiddleware({ secret: process.env.QSIGN_WEBHOOK_SECRET! }),
 *     (req, res) => {
 *       const evt = req.body as QSignWebhookBody;
 *       // process evt.event / evt.data ...
 *       res.status(200).end();
 *     },
 *   );
 */

export type QSignMiddlewareOptions = {
  secret: string;
  /** Header name (default: "x-qsign-signature"). */
  headerName?: string;
  /** When true, attaches verified body to req.qsignEvent. Default true. */
  attachEvent?: boolean;
  /** Custom error responder. Default: 401 + JSON. */
  onInvalid?: (req: any, res: any) => void;
};

export type QSignMiddlewareRequest = {
  rawBody?: Buffer | string;
  body?: any;
  headers: Record<string, any>;
  qsignEvent?: QSignWebhookBody;
};

export function qsignWebhookMiddleware(opts: QSignMiddlewareOptions) {
  const headerName = (opts.headerName || "x-qsign-signature").toLowerCase();
  const attach = opts.attachEvent !== false;

  return function qsignVerifier(req: any, res: any, next: any): void {
    const raw = req.rawBody;
    if (!raw) {
      if (opts.onInvalid) return opts.onInvalid(req, res);
      res.status(400).json({
        error: "qsign_webhook_no_raw_body",
        hint: 'mount express.json({ verify: (req,_,buf) => { req.rawBody = buf } }) before this middleware',
      });
      return;
    }
    const sig = req.headers[headerName];
    const ok = verifyQSignWebhookSignature(raw, sig, opts.secret);
    if (!ok) {
      if (opts.onInvalid) return opts.onInvalid(req, res);
      res.status(401).json({ error: "qsign_webhook_invalid_signature" });
      return;
    }
    if (attach) {
      try {
        req.qsignEvent = req.body as QSignWebhookBody;
      } catch {
        /* ignore — middleware doesn't fail just because body parser didn't run */
      }
    }
    next();
  };
}

export default qsignWebhookMiddleware;
