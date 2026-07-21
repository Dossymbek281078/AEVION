// AEVION Trust Score — Ed25519 attestation.
//
// The Trust Score itself is just a number derived from module provenance. This
// layer turns it into a *verifiable* artifact: the server signs the canonical
// score (+ a timestamp) with an Ed25519 key, so anyone can confirm that AEVION
// published exactly this measured-% at exactly this moment and that the number
// was not altered afterwards. This mirrors the QSign/QRight attestation pattern
// already used for QSkyway city twins (crypto.sign(null, …) over a SHA-256 hash)
// and fits the AEVION IP-bureau thesis: an attestation of authorship+date, NOT a
// monopoly claim. [[reference-aevion-ip-bureau-legal]]
//
// Key management reuses the QSkyway signing key so a single stable Ed25519 key
// (set as QSKYWAY_SIGN_SK on Railway) already signs the whole platform Trust
// Score — no extra secret to provision. Precedence:
//   AEVION_TRUST_SIGN_SK  → dedicated platform key (base64 PKCS8 DER)
//   QSKYWAY_SIGN_SK       → the shared QSkyway/QSign key
//   ephemeral             → generated per-instance (still verifiable, not stable)
//
// NOT included yet: an OpenTimestamps Bitcoin anchor (a follow-up — it needs an
// async round-trip to a calendar server and a later upgrade of the .ots proof).
// `asOf` gives a server-asserted time now; OTS would make it trustless. We do
// not claim an anchor we do not have.
import crypto from "crypto";
import { trustScore, type TrustScore } from "./moduleDataQuality";

function loadSignKey(): { key: crypto.KeyObject; ephemeral: boolean } {
  const env = process.env.AEVION_TRUST_SIGN_SK || process.env.QSKYWAY_SIGN_SK;
  if (env) {
    try {
      return {
        key: crypto.createPrivateKey({ key: Buffer.from(env, "base64"), format: "der", type: "pkcs8" }),
        ephemeral: false,
      };
    } catch {
      /* malformed env → fall through to ephemeral */
    }
  }
  return { key: crypto.generateKeyPairSync("ed25519").privateKey, ephemeral: true };
}

const { key: SIGN_SK, ephemeral: SIGN_EPHEMERAL } = loadSignKey();
const SIGN_PK = crypto.createPublicKey(SIGN_SK);
const SIGN_PK_B64 = SIGN_PK.export({ type: "spki", format: "der" }).toString("base64");
const KEY_FINGERPRINT = crypto
  .createHash("sha256")
  .update(SIGN_PK.export({ type: "spki", format: "der" }))
  .digest("hex")
  .slice(0, 16);

/**
 * Deterministic JSON: object keys sorted recursively so the same logical value
 * always serialises to the same bytes. Signing/verifying both go through this,
 * so key-order differences (Express JSON, client re-serialisation) never break
 * verification.
 */
function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonical((value as Record<string, unknown>)[k])).join(",") + "}";
}

// The exact fields the signature commits to. Deliberately ONLY the stable,
// numeric/structural data (all ASCII) — the localized free-text `note`/`source`
// strings are excluded. Why: those carry non-ASCII (Cyrillic) prose, and some
// transports/proxies re-encode non-ASCII (e.g. \uXXXX escaping by a client's
// JSON serialiser round-tripped through the edge proxy) in ways that change the
// bytes a verifier reconstructs, which would break an otherwise-valid signature.
// Committing to the numbers + timestamp + module ids (the KPI's actual meaning)
// makes verification transport-independent and is the honest thing to prove.
function signablePayload(score: TrustScore, asOf: string) {
  const perModule: Record<string, { measuredPct: number; realPct: number; total: number }> = {};
  for (const [id, m] of Object.entries(score.perModule ?? {})) {
    perModule[id] = { measuredPct: Number(m.measuredPct), realPct: Number(m.realPct), total: Number(m.total) };
  }
  return {
    asOf,
    score: Number(score.score),
    realPct: Number(score.realPct),
    totalItems: Number(score.totalItems),
    measured: Number(score.measured),
    derived: Number(score.derived),
    guessed: Number(score.guessed),
    modulesReporting: Number(score.modulesReporting),
    perModule,
  };
}

export interface TrustAttestation {
  alg: "Ed25519";
  /** server-asserted issue time (ISO-8601) — covered by the signature */
  asOf: string;
  /** SHA-256 hex of canonical(signablePayload) — the exact ASCII bytes that were signed */
  contentHash: string;
  /** base64 Ed25519 signature over the contentHash bytes */
  signature: string;
  /** base64 SPKI DER of the signing public key */
  publicKey: string;
  /** first 16 hex chars of SHA-256(publicKey) — short display id */
  keyFingerprint: string;
  /** true if no stable key was provisioned (per-instance key) */
  ephemeral: boolean;
  note: string;
}

/** The Trust Score plus an Ed25519 attestation over it. */
export interface SignedTrustScore extends TrustScore {
  attestation: TrustAttestation;
}

/** Compute the current Trust Score and sign it. */
export function signedTrustScore(asOf: string): SignedTrustScore {
  const score = trustScore();
  return { ...score, attestation: attest(score, asOf) };
}

function attest(score: TrustScore, asOf: string): TrustAttestation {
  const contentHash = crypto.createHash("sha256").update(canonical(signablePayload(score, asOf))).digest("hex");
  const signature = crypto.sign(null, Buffer.from(contentHash, "hex"), SIGN_SK).toString("base64");
  return {
    alg: "Ed25519",
    asOf,
    contentHash,
    signature,
    publicKey: SIGN_PK_B64,
    keyFingerprint: KEY_FINGERPRINT,
    ephemeral: SIGN_EPHEMERAL,
    note: SIGN_EPHEMERAL
      ? "Ephemeral per-instance key. Set QSKYWAY_SIGN_SK (or AEVION_TRUST_SIGN_SK) for a stable, publicly pinnable key. Ed25519-подпись доказывает неизменность значения на момент asOf."
      : "Ed25519-подпись доказывает: AEVION опубликовал именно это значение измеренных данных на момент asOf, и оно не изменено. Свидетельство авторства+даты, не монополия.",
  };
}

export interface VerifyResult {
  /** overall: hash matches AND signature is valid over it */
  valid: boolean;
  /** the recomputed hash equals the claimed contentHash (value untampered) */
  hashValid: boolean;
  /** the signature verifies against the embedded public key */
  signatureValid: boolean;
  /** the embedded public key is this server's live signing key */
  isPlatformKey: boolean;
  keyFingerprint: string;
  reason?: string;
}

/**
 * Verify a previously-issued signed score. Recomputes the canonical hash over
 * signablePayload(score, asOf) (score = the object minus its `attestation`),
 * checks it against the claimed contentHash, then verifies the Ed25519
 * signature. Only the numeric/structural fields are committed to — see
 * signablePayload — so a re-encoded free-text note never breaks verification.
 */
export function verifySignedTrustScore(input: unknown): VerifyResult {
  const base: VerifyResult = {
    valid: false,
    hashValid: false,
    signatureValid: false,
    isPlatformKey: false,
    keyFingerprint: KEY_FINGERPRINT,
  };
  if (!input || typeof input !== "object") return { ...base, reason: "body is not an object" };
  const obj = input as Record<string, unknown>;
  const att = obj.attestation as TrustAttestation | undefined;
  if (!att || typeof att !== "object") return { ...base, reason: "missing attestation" };
  if (att.alg !== "Ed25519") return { ...base, reason: "unsupported alg" };
  if (typeof att.signature !== "string" || typeof att.publicKey !== "string" || typeof att.contentHash !== "string" || typeof att.asOf !== "string") {
    return { ...base, reason: "attestation fields malformed" };
  }

  // Recompute the hash over the signable (ASCII, numeric) payload + asOf.
  const { attestation: _drop, ...score } = obj;
  const recomputed = crypto
    .createHash("sha256")
    .update(canonical(signablePayload(score as unknown as TrustScore, att.asOf)))
    .digest("hex");
  const hashValid = recomputed === att.contentHash;

  let signatureValid = false;
  let publicKeyDer: Buffer;
  try {
    publicKeyDer = Buffer.from(att.publicKey, "base64");
    const pubKey = crypto.createPublicKey({ key: publicKeyDer, format: "der", type: "spki" });
    signatureValid = crypto.verify(
      null,
      Buffer.from(att.contentHash, "hex"),
      pubKey,
      Buffer.from(att.signature, "base64"),
    );
  } catch (e) {
    return { ...base, hashValid, reason: "public key or signature not decodable" };
  }

  const isPlatformKey = att.publicKey === SIGN_PK_B64;
  const valid = hashValid && signatureValid;
  return {
    valid,
    hashValid,
    signatureValid,
    isPlatformKey,
    keyFingerprint: KEY_FINGERPRINT,
    reason: valid ? undefined : !hashValid ? "content hash mismatch (value tampered)" : "signature does not verify",
  };
}

/** Public signing key + fingerprint — so a verifier can pin AEVION's key. */
export function trustSigningKey(): { alg: "Ed25519"; publicKey: string; keyFingerprint: string; ephemeral: boolean } {
  return { alg: "Ed25519", publicKey: SIGN_PK_B64, keyFingerprint: KEY_FINGERPRINT, ephemeral: SIGN_EPHEMERAL };
}
