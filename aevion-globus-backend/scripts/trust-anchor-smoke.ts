// Smoke: AEVION Trust Score OpenTimestamps (Bitcoin) anchoring.
// Run: npx tsx scripts/trust-anchor-smoke.ts   (from aevion-globus-backend/)
//
// The stamp step is a real network call to OT calendars. Bitcoin confirmation
// takes ~1-6h, so a fresh anchor is ALWAYS "pending" here — that is expected and
// honest. Network-dependent asserts degrade gracefully (logged, not failed) so
// the smoke is meaningful offline; the deterministic asserts (Ed25519+OTS
// composition, tamper detection, input handling) are hard.
import crypto from "crypto";

const sk = crypto.generateKeyPairSync("ed25519").privateKey;
process.env.QSKYWAY_SIGN_SK = sk.export({ type: "pkcs8", format: "der" }).toString("base64");

let pass = 0, fail = 0, soft = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) { pass++; console.log("  PASS", name); }
  else { fail++; console.log("  FAIL", name, extra !== undefined ? JSON.stringify(extra) : ""); }
}
function softCheck(name: string, cond: boolean, extra?: unknown) {
  if (cond) { pass++; console.log("  PASS", name); }
  else { soft++; console.log("  SOFT", name, "(network — not counted as failure)", extra !== undefined ? JSON.stringify(extra) : ""); }
}

async function main() {
  const { anchorTrustScore, verifyAnchoredTrustScore } = await import("../src/lib/trustAnchor");

  const asOf = "2026-07-20T00:00:00.000Z";
  console.log("Stamping to OpenTimestamps calendars (network, ~1-5s)…");
  const anchored = await anchorTrustScore(asOf);
  const { snapshot, anchor } = anchored;
  console.log("anchor status:", anchor.status, "| proofBytes:", anchor.otsProofB64 ? Buffer.from(anchor.otsProofB64, "base64").length : 0, "| err:", anchor.error);

  // Deterministic: structure + hash linkage (no network needed).
  check("snapshot signed", snapshot.attestation?.alg === "Ed25519");
  check("anchor hash == attestation hash", anchor.contentHash === snapshot.attestation.contentHash);
  check("status is a known value", ["pending", "bitcoin-confirmed", "failed"].includes(anchor.status));

  const networkOk = anchor.status !== "failed";
  softCheck("calendar submission succeeded (network)", networkOk, anchor.error);
  if (networkOk) {
    check("pending anchor carries a proof", !!anchor.otsProofB64 && anchor.otsProofB64.length > 0);
  }

  // Verify the anchored snapshot: Ed25519 must be valid; OTS pending (not yet
  // Bitcoin-confirmed) so fullyProven is honestly false right after stamping.
  const v = await verifyAnchoredTrustScore({ snapshot, otsProofB64: anchor.otsProofB64 });
  check("verify: ed25519 valid", v.ed25519.valid === true, v.ed25519);
  check("verify: isPlatformKey", v.ed25519.isPlatformKey === true);
  check("verify: fresh anchor not yet fully proven (pending)", v.fullyProven === false);
  if (networkOk) {
    softCheck("verify: ots status pending", v.ots.status === "pending", v.ots);
    check("verify: ots proof round-trips back", typeof v.ots.otsProofB64 === "string" && v.ots.otsProofB64.length > 0);
  }

  // Tamper the snapshot value → Ed25519 must reject, fullyProven false.
  const tampered = JSON.parse(JSON.stringify(snapshot));
  tampered.score = 3.14;
  const bad = await verifyAnchoredTrustScore({ snapshot: tampered, otsProofB64: anchor.otsProofB64 });
  check("tampered snapshot → ed25519 invalid", bad.ed25519.valid === false && bad.ed25519.hashValid === false, bad.ed25519);
  check("tampered snapshot → not fully proven", bad.fullyProven === false);

  // Missing proof → graceful ots error, ed25519 still evaluated.
  const noProof = await verifyAnchoredTrustScore({ snapshot });
  check("missing proof → ots error", noProof.ots.error === "missing otsProofB64" && noProof.fullyProven === false, noProof.ots);
  check("missing proof → ed25519 still checked", noProof.ed25519.valid === true);

  // Malformed body.
  const empty = await verifyAnchoredTrustScore(null);
  check("null body handled", empty.fullyProven === false && empty.ed25519.valid === false);

  console.log(`\nTrust-anchor smoke: ${pass} PASS / ${fail} FAIL / ${soft} SOFT(network)`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error("THROW:", e instanceof Error ? e.stack : e);
  process.exit(1);
});
