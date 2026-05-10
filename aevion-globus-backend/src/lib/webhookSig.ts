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
  | { ok: true; mode: "hmac" | "legacy" }
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

export function verifyWebhookSig(opts: VerifyOpts): VerifyResult {
  const {
    body,
    secret,
    toleranceSec = DEFAULT_TOLERANCE_SEC,
    requireHmac = process.env.WEBHOOK_REQUIRE_HMAC === "1",
    now = () => Date.now(),
  } = opts;

  const sig = pickFirst(opts.signature);
  const ts = pickFirst(opts.timestamp);
  const legacy = pickFirst(opts.legacySecret);

  if (sig && ts) {
    const tsNum = Number(ts);
    if (!Number.isFinite(tsNum)) {
      return { ok: false, reason: "timestamp not numeric" };
    }
    const skew = Math.abs(now() / 1000 - tsNum);
    if (skew > toleranceSec) {
      return { ok: false, reason: `timestamp skew ${Math.round(skew)}s > ${toleranceSec}s` };
    }
    const payload = `${tsNum}.${stableStringify(body)}`;
    const expected = createHmac("sha256", secret).update(payload).digest("hex");
    if (sig.length !== expected.length) {
      return { ok: false, reason: "signature length mismatch" };
    }
    const a = Buffer.from(sig, "utf-8");
    const b = Buffer.from(expected, "utf-8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, reason: "signature mismatch" };
    }
    return { ok: true, mode: "hmac" };
  }

  if (requireHmac) {
    return { ok: false, reason: "HMAC headers required (WEBHOOK_REQUIRE_HMAC=1)" };
  }

  if (legacy && legacy === secret) {
    return { ok: true, mode: "legacy" };
  }

  return { ok: false, reason: "no valid HMAC and legacy secret missing/wrong" };
}
