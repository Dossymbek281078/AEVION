/**
 * Webhook HMAC-SHA256 signing + verification helpers.
 *
 * Mirrors AEVION's server-side `webhookSig.ts` exactly so a roundtrip is
 * guaranteed. Use these on the receiver side to verify incoming events,
 * and on the sender side (e.g. dev fixtures, partner mock servers) to
 * produce headers AEVION would accept.
 *
 * Wire format:
 *   X-Aevion-Signature: sha256=<hex hmac-sha256>
 *   X-Aevion-Timestamp: <unix seconds>
 *
 * Signed payload: `${timestamp}.${rawBody}`. Use the EXACT body bytes from
 * the wire — do not parse + re-serialize, that drops the signature.
 *
 * Replay protection: reject anything outside a 5-minute window. Configurable
 * via `toleranceSec`.
 *
 * Rotation: pass `previousSecrets` during a cutover window — the verifier
 * tries the current secret first, then each previous one, and reports which
 * matched via `secretIndex` (0 = current, 1+ = previous). See
 * /developers/fintech/webhooks#6 for the recommended cutover sequence.
 *
 * Node:    works on Node 18+ using `node:crypto`.
 * Browser: pass a Web Crypto subtle implementation via `cryptoImpl` (defaults
 *          to globalThis.crypto.subtle when available).
 */

const DEFAULT_TOLERANCE_SEC = 300;

export type VerifyWebhookResult =
  | { ok: true; mode: "hmac" | "legacy"; secretIndex: number }
  | { ok: false; reason: string };

export interface VerifyWebhookOpts {
  /** Signature header value (`sha256=<hex>` or bare hex). */
  signature: string | null | undefined;
  /** Timestamp header value (unix seconds, integer string). */
  timestamp: string | null | undefined;
  /** Raw request body bytes — must be the EXACT bytes received from AEVION. */
  rawBody: string;
  /** Current shared secret. */
  secret: string;
  /** Optional previous secrets accepted during a rotation window. */
  previousSecrets?: string[];
  /** Allowed clock skew in seconds (default 300). */
  toleranceSec?: number;
  /** Inject for tests; defaults to `Date.now() / 1000`. */
  now?: () => number;
}

export interface SignWebhookOpts {
  /** Canonical body string — partners must use the SAME stringification at receive time. */
  body: string | object;
  secret: string;
  /** Override timestamp for tests. Defaults to floor(Date.now()/1000). */
  timestamp?: number;
}

export interface SignWebhookResult {
  /** Hex HMAC-SHA256. Wire format: `sha256=<signature>`. */
  signature: string;
  /** Unix seconds — send as X-Aevion-Timestamp. */
  timestamp: number;
  /** The canonical payload that was hashed — `${timestamp}.${body}`. */
  signedPayload: string;
}

/** Pure-JS stable JSON stringifier (sorted keys). Same algorithm as backend's stableStringify. */
function stableStringify(value: unknown): string {
  function normalize(v: unknown): unknown {
    if (v === null || v === undefined) return null;
    const t = typeof v;
    if (t === "string" || t === "number" || t === "boolean") return v;
    if (t === "bigint") return (v as bigint).toString();
    if (v instanceof Date) return v.toISOString();
    if (Array.isArray(v)) return v.map(normalize);
    if (typeof v === "object") {
      const proto = Object.getPrototypeOf(v);
      if (proto === Object.prototype || proto === null) {
        const sorted: Record<string, unknown> = {};
        for (const k of Object.keys(v as object).sort()) {
          sorted[k] = normalize((v as Record<string, unknown>)[k]);
        }
        return sorted;
      }
    }
    try { return JSON.parse(JSON.stringify(v)); } catch { return String(v); }
  }
  return JSON.stringify(normalize(value));
}

/** Strip optional `sha256=` or `hmac-sha256:` prefix. */
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

/** Constant-time hex string compare. */
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Compute HMAC-SHA256(secret, payload) → hex via WebCrypto.
 *
 * Works in: Node 18+ (built-in globalThis.crypto.subtle), modern browsers,
 * Cloudflare Workers, Deno, edge runtimes. No native dependency.
 */
async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g: any = globalThis;
  if (!g.crypto || !g.crypto.subtle) {
    throw new Error(
      "@aevion/fintech-sdk: globalThis.crypto.subtle is unavailable. " +
      "On Node < 19, run with --experimental-global-webcrypto, or upgrade to Node 19+.",
    );
  }
  const enc = new TextEncoder();
  const key = await g.crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await g.crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b: number) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Verify an incoming webhook delivery from AEVION.
 *
 * Usage:
 *
 *   app.post("/webhooks/aevion", express.raw(...), async (req, res) => {
 *     const result = await verifyWebhook({
 *       signature: req.headers["x-aevion-signature"] as string,
 *       timestamp: req.headers["x-aevion-timestamp"] as string,
 *       rawBody: req.body.toString("utf8"),
 *       secret: process.env.AEVION_WEBHOOK_SECRET!,
 *       previousSecrets: [process.env.AEVION_WEBHOOK_SECRET_OLD!].filter(Boolean),
 *     });
 *     if (!result.ok) return res.status(401).send(result.reason);
 *     // process event…
 *     res.status(200).end();
 *   });
 */
export async function verifyWebhook(opts: VerifyWebhookOpts): Promise<VerifyWebhookResult> {
  const {
    rawBody,
    secret,
    previousSecrets = [],
    toleranceSec = DEFAULT_TOLERANCE_SEC,
    now = () => Date.now() / 1000,
  } = opts;

  if (!opts.signature || !opts.timestamp) {
    return { ok: false, reason: "missing X-Aevion-Signature or X-Aevion-Timestamp" };
  }
  const tsNum = Number(opts.timestamp);
  if (!Number.isFinite(tsNum)) {
    return { ok: false, reason: "timestamp not numeric" };
  }
  const skew = Math.abs(now() - tsNum);
  if (skew > toleranceSec) {
    return { ok: false, reason: `timestamp skew ${Math.round(skew)}s > ${toleranceSec}s` };
  }

  const sig = normalizeSignature(opts.signature);
  const payload = `${tsNum}.${rawBody}`;

  const candidates = [secret, ...previousSecrets];
  for (let i = 0; i < candidates.length; i++) {
    const expected = await hmacSha256Hex(candidates[i], payload);
    if (timingSafeEqualHex(sig, expected)) {
      return { ok: true, mode: "hmac", secretIndex: i };
    }
  }
  return { ok: false, reason: "signature mismatch" };
}

/**
 * Produce the headers AEVION would send for a given body. Use this to write
 * dev fixtures, partner mocks, or to bridge a webhook through your own
 * infrastructure preserving the canonical wire format.
 *
 * If `body` is an object, it is serialized via stable-stringify (sorted keys).
 * If it's already a string, it is signed AS-IS — pass the exact byte stream
 * AEVION would emit.
 */
export async function signWebhookPayload(opts: SignWebhookOpts): Promise<SignWebhookResult> {
  const timestamp = opts.timestamp ?? Math.floor(Date.now() / 1000);
  const bodyStr = typeof opts.body === "string" ? opts.body : stableStringify(opts.body);
  const signedPayload = `${timestamp}.${bodyStr}`;
  const signature = await hmacSha256Hex(opts.secret, signedPayload);
  return { signature, timestamp, signedPayload };
}

/**
 * Convenience: build the two AEVION webhook headers ready for `fetch`.
 *
 * @example
 * ```ts
 * const headers = await aevionWebhookHeaders({ body: payload, secret });
 * await fetch(partnerUrl, { method: "POST", headers, body: payload });
 * ```
 */
export async function aevionWebhookHeaders(opts: SignWebhookOpts): Promise<Record<string, string>> {
  const { signature, timestamp } = await signWebhookPayload(opts);
  return {
    "Content-Type": "application/json",
    "X-Aevion-Signature": `sha256=${signature}`,
    "X-Aevion-Timestamp": String(timestamp),
  };
}
