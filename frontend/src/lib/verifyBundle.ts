/**
 * Offline verification of an AEVION bundle.
 *
 * Runs entirely in the browser using WebCrypto. Does NOT contact AEVION.
 * Returns a per-check verdict so the UI can show exactly which layer
 * passed and which failed — so a verifier sees the full picture.
 *
 * Trust anchors after this module runs:
 *   - SHA-256 (verifier recomputes the hash from canonical inputs)
 *   - Ed25519 (verifier checks AEVION's and the author's signatures)
 *   - Bitcoin (verifier optionally runs an OT client against
 *     proofs.openTimestamps.proofBase64; we only flag presence here)
 */

export interface AevionBundle {
  version: number;
  bundleType: string;
  exportedAt?: string;
  certificate: {
    id: string;
    title: string;
    kind: string;
    description: string;
    author?: string | null;
    contentHash: string;
    protectedAt?: string | null;
    status?: string;
  };
  proofs: {
    contentHash: {
      algo: string;
      value: string;
      canonicalInputs: {
        title: string;
        description: string;
        kind: string;
        country: string | null;
        city: string | null;
      };
    };
    aevionEd25519: {
      algo: "Ed25519";
      publicKeyRawHex: string;
      publicKeySpkiHex?: string;
      signedPayload: string;
      signature: string;
    } | null;
    qsignHmac?: unknown;
    authorCosign: {
      algo: string;
      publicKeyBase64: string;
      signature: string;
    } | null;
    openTimestamps: {
      status: string;
      bitcoinBlockHeight: number | null;
      stampedAt: string | null;
      upgradedAt: string | null;
      proofBase64: string | null;
    } | null;
  };
}

export type CheckStatus = "pass" | "fail" | "skip";

export interface BundleVerificationResult {
  bundleShape: { status: CheckStatus; detail: string };
  contentHash: { status: CheckStatus; detail: string };
  aevionSignature: { status: CheckStatus; detail: string };
  authorCosignature: { status: CheckStatus; detail: string };
  bitcoinAnchor: { status: CheckStatus; detail: string };
  overall: CheckStatus;
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return out;
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function sha256Hex(input: ArrayBufferLike | Uint8Array): Promise<string> {
  const buf = input instanceof Uint8Array ? input : new Uint8Array(input);
  const view = new Uint8Array(buf);
  // crypto.subtle.digest returns ArrayBuffer when given a BufferSource.
  // Pass the underlying buffer + byteOffset/byteLength to avoid copies.
  const hash = await crypto.subtle.digest(
    "SHA-256",
    view,
  );
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function nfc(v: string | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  return String(v).normalize("NFC");
}

async function recomputeContentHash(inputs: {
  title: string;
  description: string;
  kind: string;
  country: string | null;
  city: string | null;
}): Promise<string> {
  const canonical: Record<string, string | null> = {
    title: nfc(inputs.title) ?? "",
    description: nfc(inputs.description) ?? "",
    kind: nfc(inputs.kind) ?? "other",
    country: nfc(inputs.country),
    city: nfc(inputs.city),
  };
  const sorted: Record<string, string | null> = {};
  for (const k of Object.keys(canonical).sort()) sorted[k] = canonical[k];
  return sha256Hex(new TextEncoder().encode(JSON.stringify(sorted)));
}

const SPKI_ED25519_PREFIX_BYTES = hexToBytes("302a300506032b6570032100");

async function importEd25519Spki(spki: Uint8Array): Promise<CryptoKey> {
  // Strip generic narrowing: Next.js builds with stricter lib.dom types
  // where the BufferSource overload requires Uint8Array<ArrayBuffer>,
  // not Uint8Array<ArrayBufferLike>.
  return crypto.subtle.importKey(
    "spki",
    spki as BufferSource,
    { name: "Ed25519" },
    true,
    ["verify"],
  );
}

function wrapRawAsSpki(raw32: Uint8Array): Uint8Array {
  const out = new Uint8Array(SPKI_ED25519_PREFIX_BYTES.length + raw32.length);
  out.set(SPKI_ED25519_PREFIX_BYTES, 0);
  out.set(raw32, SPKI_ED25519_PREFIX_BYTES.length);
  return out;
}

export function isAevionBundle(value: unknown): value is AevionBundle {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    v.bundleType === "aevion-verification-bundle" &&
    typeof v.version === "number" &&
    !!v.certificate &&
    !!v.proofs
  );
}

export async function verifyAevionBundle(
  bundle: AevionBundle,
): Promise<BundleVerificationResult> {
  const result: BundleVerificationResult = {
    bundleShape: { status: "pass", detail: "Recognized AEVION bundle v" + bundle.version },
    contentHash: { status: "skip", detail: "" },
    aevionSignature: { status: "skip", detail: "" },
    authorCosignature: { status: "skip", detail: "" },
    bitcoinAnchor: { status: "skip", detail: "" },
    overall: "pass",
  };

  /* ── 1) Content hash ── */
  try {
    const inputs = bundle.proofs.contentHash.canonicalInputs;
    const recomputed = await recomputeContentHash(inputs);
    if (recomputed === bundle.proofs.contentHash.value) {
      result.contentHash = {
        status: "pass",
        detail: "SHA-256 of canonical inputs matches the stored contentHash",
      };
    } else {
      result.contentHash = {
        status: "fail",
        detail: `Recomputed ${recomputed.slice(0, 12)}... but bundle says ${bundle.proofs.contentHash.value.slice(0, 12)}...`,
      };
    }
  } catch (e) {
    result.contentHash = { status: "fail", detail: (e as Error).message };
  }

  /* ── 2) AEVION Ed25519 signature ── */
  const aevion = bundle.proofs.aevionEd25519;
  if (!aevion) {
    result.aevionSignature = {
      status: "skip",
      detail: "Bundle contains no AEVION Ed25519 signature",
    };
  } else {
    try {
      const rawPub = hexToBytes(aevion.publicKeyRawHex);
      if (rawPub.length !== 32) {
        throw new Error(`expected 32-byte raw Ed25519, got ${rawPub.length}`);
      }
      const spki = wrapRawAsSpki(rawPub);
      const pubKey = await importEd25519Spki(spki);
      const sigBytes = hexToBytes(aevion.signature);
      const messageBytes = new TextEncoder().encode(aevion.signedPayload);
      const ok = await crypto.subtle.verify(
        { name: "Ed25519" },
        pubKey,
        sigBytes as BufferSource,
        messageBytes as BufferSource,
      );
      result.aevionSignature = ok
        ? {
            status: "pass",
            detail: "AEVION's Ed25519 signature validates against the signed payload",
          }
        : {
            status: "fail",
            detail: "AEVION signature does not validate — bundle has been tampered",
          };
    } catch (e) {
      result.aevionSignature = { status: "fail", detail: (e as Error).message };
    }
  }

  /* ── 3) Author co-signature ── */
  const co = bundle.proofs.authorCosign;
  if (!co) {
    result.authorCosignature = {
      status: "skip",
      detail: "Bundle has no author co-signature (legacy single-party cert)",
    };
  } else {
    try {
      const rawPub = base64ToBytes(co.publicKeyBase64);
      if (rawPub.length !== 32) {
        throw new Error(`expected 32-byte raw Ed25519 author key, got ${rawPub.length}`);
      }
      const sig = base64ToBytes(co.signature);
      if (sig.length !== 64) {
        throw new Error(`expected 64-byte Ed25519 signature, got ${sig.length}`);
      }
      const spki = wrapRawAsSpki(rawPub);
      const pubKey = await importEd25519Spki(spki);
      const messageBytes = new TextEncoder().encode(
        bundle.proofs.contentHash.value,
      );
      const ok = await crypto.subtle.verify(
        { name: "Ed25519" },
        pubKey,
        sig as BufferSource,
        messageBytes as BufferSource,
      );
      const fpHash = await sha256Hex(rawPub);
      const fp = fpHash.slice(0, 16);
      result.authorCosignature = ok
        ? {
            status: "pass",
            detail: `Author Ed25519 signature validates · key fingerprint ed25519:${fp}`,
          }
        : {
            status: "fail",
            detail: `Author signature does not validate · purported key ed25519:${fp}`,
          };
    } catch (e) {
      result.authorCosignature = { status: "fail", detail: (e as Error).message };
    }
  }

  /* ── 4) OpenTimestamps Bitcoin anchor (presence check only) ── */
  const ots = bundle.proofs.openTimestamps;
  if (!ots) {
    result.bitcoinAnchor = {
      status: "skip",
      detail: "Bundle has no OpenTimestamps proof",
    };
  } else if (ots.status === "bitcoin-confirmed" && ots.bitcoinBlockHeight) {
    result.bitcoinAnchor = {
      status: "pass",
      detail: `Anchored at Bitcoin block #${ots.bitcoinBlockHeight}. Verify the .ots proof bytes with any OpenTimestamps client to mathematically prove inclusion.`,
    };
  } else if (ots.status === "pending") {
    result.bitcoinAnchor = {
      status: "skip",
      detail: "OpenTimestamps proof is pending — submitted to OT calendar, awaiting Bitcoin block inclusion (1–6h after stamping).",
    };
  } else {
    result.bitcoinAnchor = {
      status: "fail",
      detail: `OT proof status: ${ots.status}`,
    };
  }

  /* ── Overall ── */
  const allChecks = [
    result.bundleShape,
    result.contentHash,
    result.aevionSignature,
    result.authorCosignature,
    result.bitcoinAnchor,
  ];
  if (allChecks.some((c) => c.status === "fail")) result.overall = "fail";
  else if (allChecks.every((c) => c.status === "skip")) result.overall = "fail";
  else result.overall = "pass";

  return result;
}
