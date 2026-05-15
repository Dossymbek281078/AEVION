import { createHmac, timingSafeEqual } from "node:crypto";
import { stableStringify } from "./stableStringify";

// HMAC + timestamp replay protection for webhook receivers.
//
// Verification chain:
//   1. If X-Aevion-Signature + X-Aevion-Timestamp headers are present,
//      verify HMAC-SHA256(`${timestamp}.${stableStringify(body)}`, secret)
//      with a ±5min timestamp window (configurable).
//   2. Otherwise fall back to legacy bearer-style header equality
//      (X-QRight-Secret / X-CyberChess-Secret / X-Planet-Secret) so
//      existing dev fixtures and partner integrations keep working.
//
// Set WEBHOOK_REQUIRE_HMAC=1 to disable the legacy fallback in prod.
//
// The stable-stringify pivot means partners must serialize the body with
// sorted keys before signing — same convention QSign uses. This is
// documented for partners; see /api docs and integrations/README.

const DEFAULT_TOLERANCE_SEC = 300;

export type VerifyResult =
  | { ok: true; mode: "hmac" | "legacy"; secretIndex?: number }
  | { ok: false; reason: string };

export type VerifyOpts = {
  /** Header value for X-Aevion-Signature (hex hmac-sha256). */
  signature?: string | string[];
  /** Header value for X-Aevion-Timestamp (unix seconds, integer). */
  timestamp?: string | string[];
  /** Header value for the legacy static secret (X-*-Secret). */
  legacySecret?: string | string[];
  /** Body the partner signed — must serialize stably. */
  body: unknown;
  /** Shared secret. */
  secret: string;
  /**
   * Optional previous secrets accepted during a rotation window.
   * Receiver tries the current secret first, then each previous secret in order.
   * On success, `secretIndex` in the result reports which secret matched
   * (0 = current, 1 = first previous, etc.) so ops can log rotation lag.
   */
  previousSecrets?: string[];
  /** Allowed clock skew in seconds (default 300). */
  toleranceSec?: number;
  /** When true, reject if HMAC headers absent (no legacy fallback). */
  requireHmac?: boolean;
  /** Inject `Date.now()` for tests. */
  now?: () => number;
};

function pickFirst(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

/**
 * Strip optional algorithm prefix from a signature header value.
 * Accepts: `sha256=hex`, `hmac-sha256:hex`, or bare `hex`.
 */
function normalizeSignature(raw: string): string {
  const trimmed = raw.trim();
  const eq = trimmed.indexOf("=");
  if (eq > 0 && eq < 32) {
    const prefix = trimmed.slice(0, eq).toLowerCase();
    if (prefix === "sha256" || prefix === "hmac-sha256") return trimmed.slice(eq + 1);
  }
  const colon = trimmed.indexOf(":");
  if (colon > 0 && colon < 32) {
    const prefix = trimmed.slice(0, colon).toLowerCase();
    if (prefix === "sha256" || prefix === "hmac-sha256") return trimmed.slice(colon + 1);
  }
  return trimmed;
}

function constantTimeHexEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const aBuf = Buffer.from(a, "utf-8");
  const bBuf = Buffer.from(b, "utf-8");
  return aBuf.length === bBuf.length && timingSafeEqual(aBuf, bBuf);
}

export function verifyWebhookSig(opts: VerifyOpts): VerifyResult {
  const {
    body,
    secret,
    previousSecrets = [],
    toleranceSec = DEFAULT_TOLERANCE_SEC,
    requireHmac = process.env.WEBHOOK_REQUIRE_HMAC === "1",
    now = () => Date.now(),
  } = opts;

  const sigRaw = pickFirst(opts.signature);
  const ts = pickFirst(opts.timestamp);
  const legacy = pickFirst(opts.legacySecret);

  if (sigRaw && ts) {
    const tsNum = Number(ts);
    if (!Number.isFinite(tsNum)) {
      return { ok: false, reason: "timestamp not numeric" };
    }
    const skew = Math.abs(now() / 1000 - tsNum);
    if (skew > toleranceSec) {
      return { ok: false, reason: `timestamp skew ${Math.round(skew)}s > ${toleranceSec}s` };
    }
    const sig = normalizeSignature(sigRaw);
    const payload = `${tsNum}.${stableStringify(body)}`;
    const candidates = [secret, ...previousSecrets];
    for (let i = 0; i < candidates.length; i++) {
      const expected = createHmac("sha256", candidates[i]).update(payload).digest("hex");
      if (constantTimeHexEq(sig, expected)) {
        return { ok: true, mode: "hmac", secretIndex: i };
      }
    }
    return { ok: false, reason: "signature mismatch" };
  }

  if (requireHmac) {
    return { ok: false, reason: "HMAC headers required (WEBHOOK_REQUIRE_HMAC=1)" };
  }

  if (legacy) {
    if (legacy === secret) return { ok: true, mode: "legacy", secretIndex: 0 };
    for (let i = 0; i < previousSecrets.length; i++) {
      if (legacy === previousSecrets[i]) return { ok: true, mode: "legacy", secretIndex: i + 1 };
    }
  }

  return { ok: false, reason: "no valid HMAC and legacy secret missing/wrong" };
}

export type SignWebhookOpts = {
  body: unknown;
  secret: string;
  /** Override timestamp for tests (defaults to Date.now()/1000 floored). */
  timestamp?: number;
};

export type SignWebhookResult = {
  /** Hex HMAC-SHA256 — use directly or prefix with `sha256=` per partner contract. */
  signature: string;
  /** Unix seconds — send as X-Aevion-Timestamp. */
  timestamp: number;
  /** Canonical payload that was hashed — same format the receiver re-derives. */
  signedPayload: string;
};

/**
 * Sender-side helper: produce the headers a partner expects.
 *
 *   const { signature, timestamp } = signWebhookPayload({ body, secret });
 *   fetch(url, { headers: {
 *     "X-Aevion-Signature": `sha256=${signature}`,
 *     "X-Aevion-Timestamp": String(timestamp),
 *   }, ... });
 *
 * Mirrors verifyWebhookSig exactly so a roundtrip is guaranteed.
 */
export function signWebhookPayload(opts: SignWebhookOpts): SignWebhookResult {
  const timestamp = opts.timestamp ?? Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${stableStringify(opts.body)}`;
  const signature = createHmac("sha256", opts.secret).update(signedPayload).digest("hex");
  return { signature, timestamp, signedPayload };
}

/** Convenience: assert a verify result is ok, otherwise throw. Useful in routes. */
export function assertWebhookSig(result: VerifyResult): asserts result is { ok: true; mode: "hmac" | "legacy"; secretIndex?: number } {
  if (!result.ok) {
    const err = new Error(`webhook signature rejected: ${result.reason}`);
    (err as Error & { statusCode?: number }).statusCode = 401;
    throw err;
  }
}
