#!/usr/bin/env node
/**
 * QSign v2 — generate production secrets.
 *
 * Prints fresh values for QSIGN_HMAC_V1_SECRET and QSIGN_ED25519_V1_PRIVATE
 * (and the matching public key) to stdout. Copy them straight into Railway
 * Variables (or your prod env store). They are NOT written to disk.
 *
 * Usage (from aevion-globus-backend/):
 *   node scripts/qsign-v2-gen-prod-secrets.js
 *
 * Add --json for machine-readable output.
 *
 * IMPORTANT
 *   These secrets sign every QSign v2 signature. Once any signature is
 *   created with them in production, they MUST be preserved forever
 *   (retired keys still verify historical signatures via /api/qsign/v2/keys).
 *   Losing them = every prior signature becomes unverifiable. Back up to a
 *   password manager BEFORE you paste them into Railway.
 */

const crypto = require("crypto");

const hmac = crypto.randomBytes(32).toString("hex"); // 64 hex chars = 32 bytes >> 16 char minimum
const edSeed = crypto.randomBytes(32).toString("hex"); // 32-byte raw seed

const seedBuf = Buffer.from(edSeed, "hex");
const der = Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), seedBuf]);
const privateKey = crypto.createPrivateKey({ key: der, format: "der", type: "pkcs8" });
const publicKey = crypto.createPublicKey(privateKey);
const spki = publicKey.export({ format: "der", type: "spki" });
const edPublic = spki.subarray(spki.length - 32).toString("hex");

if (process.argv.includes("--json")) {
  process.stdout.write(
    JSON.stringify(
      {
        QSIGN_HMAC_V1_SECRET: hmac,
        QSIGN_ED25519_V1_PRIVATE: edSeed,
        QSIGN_ED25519_V1_PUBLIC: edPublic,
      },
      null,
      2,
    ) + "\n",
  );
  process.exit(0);
}

console.log("");
console.log("  QSign v2 — production secrets");
console.log("  ─────────────────────────────────────────────────────────────────");
console.log("");
console.log("  Paste these into your prod env store (Railway → service → Variables).");
console.log("  Back them up to a password manager FIRST — losing them invalidates");
console.log("  every signature ever issued in prod (no recovery path).");
console.log("");
console.log("  QSIGN_HMAC_V1_SECRET");
console.log(`    ${hmac}`);
console.log("");
console.log("  QSIGN_ED25519_V1_PRIVATE");
console.log(`    ${edSeed}`);
console.log("");
console.log("  QSIGN_ED25519_V1_PUBLIC      (optional; backend derives if absent)");
console.log(`    ${edPublic}`);
console.log("");
console.log("  ─────────────────────────────────────────────────────────────────");
console.log("");
console.log("  Need to rotate later? Use POST /api/qsign/v2/keys/rotate (admin).");
console.log("  Old keys are kept in the registry as 'retired' and continue to");
console.log("  verify historical signatures forever.");
console.log("");
