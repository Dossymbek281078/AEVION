// Smoke: AEVION Trust Score Ed25519 attestation.
// Run: npx tsx scripts/trust-signature-smoke.ts   (from aevion-globus-backend/)
//
// Uses a fixed key via QSKYWAY_SIGN_SK so isPlatformKey / stable-key assertions
// are deterministic (otherwise the lib generates an ephemeral per-run key).
import crypto from "crypto";

// Provide a stable signing key BEFORE importing the lib (it reads env at load).
const sk = crypto.generateKeyPairSync("ed25519").privateKey;
process.env.QSKYWAY_SIGN_SK = sk.export({ type: "pkcs8", format: "der" }).toString("base64");

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) { pass++; console.log("  PASS", name); }
  else { fail++; console.log("  FAIL", name, extra !== undefined ? JSON.stringify(extra) : ""); }
}

async function main() {
  const { signedTrustScore, verifySignedTrustScore, trustSigningKey } = await import("../src/lib/trustSignature");

  const asOf = "2026-07-17T00:00:00.000Z";
  const signed = signedTrustScore(asOf);

  console.log("Trust Score:", signed.score + "%", "·", signed.modulesReporting, "modules ·", signed.totalItems, "items");
  console.log("Attestation fp:", signed.attestation.keyFingerprint, "ephemeral:", signed.attestation.ephemeral);

  // 1. Shape.
  check("score fields present", typeof signed.score === "number" && typeof signed.modulesReporting === "number");
  check("attestation present", !!signed.attestation && signed.attestation.alg === "Ed25519");
  check("asOf preserved", signed.attestation.asOf === asOf);
  check("stable (non-ephemeral) key", signed.attestation.ephemeral === false);

  // 2. Round-trip verify of an untouched signed score.
  const ok = verifySignedTrustScore(signed);
  check("valid signature verifies", ok.valid === true, ok);
  check("hashValid true", ok.hashValid === true);
  check("signatureValid true", ok.signatureValid === true);
  check("isPlatformKey true", ok.isPlatformKey === true);

  // 3. Tamper the score value → hash must fail.
  const tamperedValue = JSON.parse(JSON.stringify(signed));
  tamperedValue.score = 99.9;
  const bad1 = verifySignedTrustScore(tamperedValue);
  check("tampered value rejected", bad1.valid === false && bad1.hashValid === false, bad1);

  // 4. Tamper a nested perModule count → hash must fail (canonical covers all).
  const tamperedNested = JSON.parse(JSON.stringify(signed));
  const firstMod = Object.keys(tamperedNested.perModule)[0];
  if (firstMod) tamperedNested.perModule[firstMod].measuredPct = 100;
  const bad2 = verifySignedTrustScore(tamperedNested);
  check("tampered nested count rejected", bad2.valid === false && bad2.hashValid === false, bad2);

  // 5. Tamper the signature bytes → signature must fail (hash still ok).
  const tamperedSig = JSON.parse(JSON.stringify(signed));
  const sigBuf = Buffer.from(tamperedSig.attestation.signature, "base64");
  sigBuf[0] ^= 0xff;
  tamperedSig.attestation.signature = sigBuf.toString("base64");
  const bad3 = verifySignedTrustScore(tamperedSig);
  check("tampered signature rejected", bad3.valid === false && bad3.hashValid === true && bad3.signatureValid === false, bad3);

  // 6. A signature from a DIFFERENT key verifies mathematically but is not the platform key.
  const otherSk = crypto.generateKeyPairSync("ed25519").privateKey;
  const otherPub = crypto.createPublicKey(otherSk);
  const forged = JSON.parse(JSON.stringify(signed));
  forged.attestation.publicKey = otherPub.export({ type: "spki", format: "der" }).toString("base64");
  forged.attestation.signature = crypto
    .sign(null, Buffer.from(forged.attestation.contentHash, "hex"), otherSk)
    .toString("base64");
  const other = verifySignedTrustScore(forged);
  check("foreign-key sig verifies but is not platform key", other.signatureValid === true && other.isPlatformKey === false, other);

  // 6b. Re-encoding the free-text note must NOT break verification — the note is
  // not part of the signed payload (transport-robustness: proxies re-encode
  // non-ASCII). Only numbers/timestamp/module-ids are committed to.
  const noteChanged = JSON.parse(JSON.stringify(signed));
  noteChanged.note = "totally different description — not signed";
  const nc = verifySignedTrustScore(noteChanged);
  check("changed free-text note still verifies (note not signed)", nc.valid === true, nc);

  // 6c. The signed payload is pure ASCII — a hash basis a proxy cannot mangle.
  // Simulate a client whose JSON serialiser \u-escapes any non-ASCII, round-trip
  // through parse, and confirm the hash still matches.
  const escaped = JSON.stringify(signed).replace(/[^\x00-\x7F]/g, (c) =>
    "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"),
  );
  const roundTripped = JSON.parse(escaped);
  check("unicode-escaped round-trip still verifies", verifySignedTrustScore(roundTripped).valid === true);

  // 7. Malformed input handled gracefully.
  check("null body rejected", verifySignedTrustScore(null).valid === false);
  check("no-attestation body rejected", verifySignedTrustScore({ score: 5 }).valid === false);

  // 8. Public key endpoint payload.
  const key = trustSigningKey();
  check("signing key exposed", key.alg === "Ed25519" && typeof key.publicKey === "string" && key.keyFingerprint.length === 16);
  check("key fingerprint matches attestation", key.keyFingerprint === signed.attestation.keyFingerprint);

  console.log(`\nTrust-signature smoke: ${pass} PASS / ${fail} FAIL`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error("THROW:", e instanceof Error ? e.stack : e);
  process.exit(1);
});
