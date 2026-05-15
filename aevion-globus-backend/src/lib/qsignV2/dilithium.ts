/**
 * Real ML-DSA-65 (FIPS 204 Dilithium) — opt-in via QSIGN_DILITHIUM_V1_SEED.
 *
 * Backed by `@noble/post-quantum`, a pure-JS audited implementation. The
 * package is ESM-only; this backend is CJS, so we load it via a runtime
 * `new Function('return import()')` shim that survives tsc's transformation
 * to require(). The module is loaded lazily on first sign/verify call and
 * cached for the process lifetime.
 *
 * Two modes coexist for backward compatibility with rows signed under the
 * old preview path:
 *
 *   PREVIEW  — deterministic SHA-512(canonical || kid), 128 hex chars,
 *              `mode: "preview"`. No private key needed. Fallback when
 *              QSIGN_DILITHIUM_V1_SEED is unset.
 *
 *   REAL     — actual ML-DSA-65 signature, ~6618 hex chars, `mode: "real"`.
 *              Requires QSIGN_DILITHIUM_V1_SEED (32-hex-byte seed).
 *
 * Verify auto-detects by signature length so a /verify call against a
 * historical preview row still returns valid even after env upgrade.
 */

import crypto from "crypto";

type MlDsa65 = {
  keygen: (seed: Uint8Array) => { publicKey: Uint8Array; secretKey: Uint8Array };
  sign: (msg: Uint8Array, secretKey: Uint8Array, opts?: { context?: Uint8Array }) => Uint8Array;
  verify: (sig: Uint8Array, msg: Uint8Array, publicKey: Uint8Array) => boolean;
  lengths: { signature: number; secretKey: number; publicKey: number; seed: number };
};

let mldsaCache: MlDsa65 | null = null;

/** Use a CJS shim (./dilithiumLoader.js) for the actual `import()` call.
 * The shim sits in plain JS so neither tsc (module: commonjs would lower
 * import() to require(), which fails on ESM-only packages) nor vitest's
 * module transformer touches it. The path inside the shim is a literal —
 * no user input reaches dynamic import. */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const dilithiumLoader: { loadMlDsa: () => Promise<any> } = require("./dilithiumLoader.js");

async function loadMlDsa(): Promise<MlDsa65> {
  if (mldsaCache) return mldsaCache;
  const mod = await dilithiumLoader.loadMlDsa();
  mldsaCache = mod.ml_dsa65 as MlDsa65;
  return mldsaCache;
}

export const DILITHIUM_KID_REAL = "qsign-dilithium-mldsa65-v1";
export const DILITHIUM_KID_PREVIEW = "qsign-dilithium-mldsa65-preview-v1";
export const DILITHIUM_PREVIEW_HEX_LEN = 128; // SHA-512 hex
export const DILITHIUM_REAL_HEX_LEN = 6618;   // 3309 bytes * 2

type RealKeypair = {
  kid: typeof DILITHIUM_KID_REAL;
  publicKey: Uint8Array;
  secretKey: Uint8Array;
};
let realKeypairCache: RealKeypair | null = null;

/**
 * Reads QSIGN_DILITHIUM_V1_SEED → 32-byte hex seed → derives keypair via
 * deterministic ML-DSA-65 keygen. Returns null if env unset/invalid (so
 * caller falls through to preview mode).
 *
 * Cached per-process. Keys are large (~6 KB combined) but only resident
 * once.
 */
export async function getActiveDilithium(): Promise<RealKeypair | null> {
  if (realKeypairCache) return realKeypairCache;
  const seedHex = process.env.QSIGN_DILITHIUM_V1_SEED?.trim();
  if (!seedHex) return null;
  if (!/^[0-9a-fA-F]{64}$/.test(seedHex)) {
    console.warn(
      "[qsign v2] QSIGN_DILITHIUM_V1_SEED set but not a 64-hex-char string; falling back to preview mode",
    );
    return null;
  }
  const seed = Buffer.from(seedHex, "hex");
  const ml = await loadMlDsa();
  const { publicKey, secretKey } = ml.keygen(seed);
  realKeypairCache = { kid: DILITHIUM_KID_REAL, publicKey, secretKey };
  return realKeypairCache;
}

export type DilithiumSignResult = {
  kid: string;
  signature: string;
  mode: "preview" | "real";
  publicKey?: string; // hex, only for real mode
};

/**
 * Sign a canonical payload string. Returns real ML-DSA-65 signature when
 * env seed is set, otherwise the deterministic SHA-512 preview fingerprint.
 * The signed payload has the same shape as `signEd25519Hex` consumes
 * (canonical UTF-8 string).
 */
export async function signDilithium(canonical: string): Promise<DilithiumSignResult> {
  const real = await getActiveDilithium();
  if (real) {
    const ml = await loadMlDsa();
    const sig = ml.sign(Buffer.from(canonical, "utf8"), real.secretKey);
    return {
      kid: real.kid,
      signature: Buffer.from(sig).toString("hex"),
      mode: "real",
      publicKey: Buffer.from(real.publicKey).toString("hex"),
    };
  }
  // Preview fallback — deterministic fingerprint of canonical||kid.
  const fingerprint = crypto
    .createHash("sha512")
    .update(canonical + "||" + DILITHIUM_KID_PREVIEW, "utf8")
    .digest("hex");
  return {
    kid: DILITHIUM_KID_PREVIEW,
    signature: fingerprint,
    mode: "preview",
  };
}

/**
 * Verify a Dilithium signature on a canonical payload. Auto-detects mode
 * by signature length so historical preview rows continue to verify after
 * the operator turns on real ML-DSA via env.
 *
 * Returns:
 *   { valid: boolean, mode: "preview" | "real" | "unknown" }
 */
export async function verifyDilithium(
  canonical: string,
  signatureHex: string,
  storedKid?: string | null,
): Promise<{ valid: boolean; mode: "preview" | "real" | "unknown" }> {
  if (!signatureHex || typeof signatureHex !== "string") {
    return { valid: false, mode: "unknown" };
  }
  // Strip whitespace defensively, no other normalization.
  const sig = signatureHex.trim();

  // Preview mode: 128 hex chars OR explicit preview kid stored on row.
  const looksPreview =
    sig.length === DILITHIUM_PREVIEW_HEX_LEN ||
    storedKid === DILITHIUM_KID_PREVIEW;
  if (looksPreview) {
    const expected = crypto
      .createHash("sha512")
      .update(canonical + "||" + DILITHIUM_KID_PREVIEW, "utf8")
      .digest("hex");
    return { valid: timingSafeHexEq(sig, expected), mode: "preview" };
  }

  // Real mode: ~6618 hex chars; fall through to ML-DSA-65 verify.
  if (sig.length !== DILITHIUM_REAL_HEX_LEN) {
    return { valid: false, mode: "unknown" };
  }
  const real = await getActiveDilithium();
  if (!real) {
    // Real-mode signature but operator lacks the seed to derive the public
    // key. Treat as unknown rather than invalid — surfaces a config issue
    // instead of a false "tampered" verdict.
    return { valid: false, mode: "real" };
  }
  try {
    const ml = await loadMlDsa();
    const sigBytes = Buffer.from(sig, "hex");
    const ok = ml.verify(sigBytes, Buffer.from(canonical, "utf8"), real.publicKey);
    return { valid: ok, mode: "real" };
  } catch {
    return { valid: false, mode: "real" };
  }
}

function timingSafeHexEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}
