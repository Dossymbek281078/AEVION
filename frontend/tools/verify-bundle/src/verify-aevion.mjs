#!/usr/bin/env node
/*
 * verify-aevion.mjs — independent verifier for AEVION authorship signatures.
 *
 * WHY THIS EXISTS. A buyer of licensed data should not have to trust the
 * seller's word that a signature is valid. This script recomputes everything
 * itself with Node's built-in crypto: it never reads the `valid` flags that
 * our API returns, and it needs no library, no account and no key from us.
 *
 * WHAT IT CHECKS, per record:
 *   1. payloadHash == sha256(payloadCanonical)        (the hash is honest)
 *   2. Ed25519 signature verifies over payloadCanonical using the published
 *      public key                                      (the signature is ours)
 *   3. the record is not revoked                       (it is still in force)
 *   4. if the manifest pins a public key, the record uses THAT key
 *                                                      (no silent key swap)
 *
 * WHAT IT DOES NOT CHECK, stated plainly:
 *   - who the author is. The signature proves the file belongs to the holder
 *     of the key; it does not prove the holder is who they claim to be.
 *     AEVION identity verification is a stub today.
 *   - consent to train. No such field exists yet.
 *
 * USAGE
 *   node verify-aevion.mjs manifest.json
 *   node verify-aevion.mjs --selftest        (negative controls, no network)
 *
 * EXIT CODES
 *   0  every record verified
 *   1  at least one record failed            (the reason is printed)
 *   2  could not run at all                  (this is NOT a pass)
 */

import { createHash, createPublicKey, verify as cryptoVerify } from "node:crypto";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const SPKI_ED25519_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

function ed25519KeyFromHex(hex) {
  const raw = Buffer.from(hex, "hex");
  if (raw.length !== 32) throw new Error(`public key must be 32 bytes, got ${raw.length}`);
  return createPublicKey({
    key: Buffer.concat([SPKI_ED25519_PREFIX, raw]),
    format: "der",
    type: "spki",
  });
}

/**
 * Deep equality for plain JSON data. Numbers compare by value, so 1 and 1.0 are
 * the same datum; key order is irrelevant, as it is in JSON itself.
 */
function sameData(a, b) {
  if (a === b) return true;
  if (typeof a === "number" && typeof b === "number") return a === b || (Number.isNaN(a) && Number.isNaN(b));
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => sameData(v, b[i]));
  }
  const ka = Object.keys(a).sort();
  const kb = Object.keys(b).sort();
  if (ka.length !== kb.length || ka.some((k, i) => k !== kb[i])) return false;
  return ka.every((k) => sameData(a[k], b[k]));
}

/**
 * Checks one record. Returns a list of problems; empty list means it passed.
 *
 * `localFile` is the file you actually received. Pass it and the check stops
 * being "a valid signature exists somewhere" and becomes "THIS file is the one
 * that was signed" — which is the only version worth anything to a buyer.
 */
export function checkRecord(record, pinnedPublicKey, localFile) {
  const problems = [];
  const canonical = record.payloadCanonical;
  if (typeof canonical !== "string" || canonical.length === 0) {
    return ["no payloadCanonical — nothing to verify"];
  }

  const recomputed = createHash("sha256").update(canonical, "utf8").digest("hex");
  if (recomputed !== record.payloadHash) {
    problems.push(`payloadHash does not match the payload (expected ${recomputed})`);
  }

  const ed = record.ed25519;
  if (!ed || !ed.signature || !ed.publicKey) {
    problems.push("no Ed25519 signature on this record");
  } else {
    if (pinnedPublicKey && ed.publicKey !== pinnedPublicKey) {
      problems.push("signed with a different key than the manifest pins");
    }
    let ok = false;
    try {
      ok = cryptoVerify(
        null,
        Buffer.from(canonical, "utf8"),
        ed25519KeyFromHex(ed.publicKey),
        Buffer.from(ed.signature, "hex"),
      );
    } catch (e) {
      problems.push(`signature could not be checked: ${e.message}`);
    }
    if (!ok && problems.length === 0) problems.push("Ed25519 signature does NOT verify");
    else if (!ok) problems.push("Ed25519 signature does NOT verify");
  }

  /*
   * The record carries the same data twice: `payload` (an object, meant to be
   * read by a human) and `payloadCanonical` (the string that was actually
   * signed). Only the second one is signed, so tampering with the first used
   * to change nothing and the verifier still said OK.
   *
   * Why that mattered more than it looks. A careful buyer does exactly what a
   * careful buyer should: alters a byte in the payload he can read, re-runs the
   * verifier, and expects it to complain. Getting "checked 5, failed 0" he
   * concludes the signature does not cover the data — and he is wrong, but he
   * will not write to us to check. We measured this on ourselves on 13 Oct 2026.
   *
   * So: if `payload` is present, it must be the same data as the signed string.
   * Absent `payload` is not a problem — older manifests do not carry it.
   */
  if (record.payload !== undefined && record.payload !== null) {
    let signedData;
    try {
      signedData = JSON.parse(canonical);
    } catch {
      /* already reported as "payload is not JSON" where it matters */
      signedData = undefined;
    }
    if (signedData !== undefined && !sameData(record.payload, signedData)) {
      problems.push("payload does not match the signed payloadCanonical — the readable copy was changed");
    }
  }

  if (record.revoked === true) {
    problems.push(`revoked${record.revokedAt ? " on " + record.revokedAt : ""}`);
  }

  /*
   * Tie the signature to the bytes in your hand. Without this the whole
   * exercise proves only that some record exists and verifies; it says
   * nothing about the file you were sent.
   */
  if (localFile) {
    let signedHash = null;
    try {
      signedHash = JSON.parse(canonical).sha256;
    } catch {
      problems.push("payload is not JSON — cannot tie it to a file");
    }
    if (signedHash === undefined || signedHash === null) {
      problems.push("the signed payload names no sha256 — cannot tie it to a file");
    } else {
      let actual;
      try {
        actual = createHash("sha256").update(readFileSync(localFile)).digest("hex");
      } catch (e) {
        problems.push(`cannot read ${localFile}: ${e.message}`);
      }
      if (actual && actual !== signedHash) {
        problems.push(`the file you hold is NOT the signed one (yours ${actual.slice(0, 16)}…, signed ${String(signedHash).slice(0, 16)}…)`);
      }
    }
  }
  return problems;
}

async function fetchRecord(apiBase, id) {
  const res = await fetch(`${apiBase}/api/qsign/v2/${id}/public`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("usage: node verify-aevion.mjs <manifest.json> | --selftest");
    process.exit(2);
  }
  if (arg === "--selftest") return selftest();

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(arg, "utf8"));
  } catch (e) {
    console.error(`cannot read manifest: ${e.message}`);
    process.exit(2);
  }

  const apiBase = manifest.apiBase || "https://api.aevion.app";
  const pinned = manifest.publicKey || null;
  const entries = manifest.records || [];
  if (entries.length === 0) {
    console.error("manifest lists no records — nothing was checked");
    process.exit(2);
  }

  let failed = 0;
  for (const entry of entries) {
    const id = typeof entry === "string" ? entry : entry.id;
    const label = (entry && entry.file) || id;
    let record = entry && entry.record;
    /*
     * A manifest straight out of `bundle prepare` has null ids. Without this
     * branch the fetch returned HTTP 404 and the operator was sent chasing a
     * network fault instead of reading 'this delivery was never signed'.
     */
    if (!record && !id) {
      console.log(`FAIL  ${label}  no signature id in the manifest — this delivery has not been signed`);
      failed++;
      continue;
    }
    if (!record) {
      try {
        record = await fetchRecord(apiBase, id);
      } catch (e) {
        console.log(`FAIL  ${label}  could not fetch: ${e.message}`);
        failed++;
        continue;
      }
    }
    const localFile = entry && entry.localFile;
    const problems = checkRecord(record, pinned, localFile);
    if (problems.length === 0) console.log(`OK    ${label}`);
    else {
      failed++;
      console.log(`FAIL  ${label}  ${problems.join("; ")}`);
    }
  }

  console.log(`\nchecked ${entries.length}, failed ${failed}`);
  /*
   * process.exitCode, NOT process.exit(): calling exit() here killed the
   * process while fetch still held an open handle, and node died with a
   * libuv assertion and exit code 127 instead of our 1 -- garbage on the
   * one path that matters. Measured 2026-10-02 on the revoked control.
   */
  process.exitCode = failed === 0 ? 0 : 1;
}

/* ------------------------------------------------------------------ *
 * Self-test. Runs offline on a record embedded below. The point is the
 * NEGATIVE controls: a verifier that says "OK" to everything is worse
 * than no verifier, so each control breaks one thing and must be caught.
 * ------------------------------------------------------------------ */
const SAMPLE = {
  id: "ce697809-c8c9-42a5-8d13-8c31de82fac6",
  payloadCanonical: '{"idem":"test","n":1}',
  payloadHash: "f32281561bc8294fe65ab2fc96961a95983bcab5fc03166207d627135037506b",
  revoked: false,
  ed25519: {
    kid: "qsign-ed25519-v1",
    publicKey: "63fd4f60e1839498443a99cd69710fe3c7089606fb2188b75246f9903c0b36b8",
    signature:
      "f7c87d18b1a2c50f3ddcb16c8dd1ccbab8349ba465e786cd9b27d04acd015c7fd2943ee638969190ea0f62ad87799578154aeb3fe0c38d0813b6606020c05d0f",
  },
};

function selftest() {
  const clone = () => JSON.parse(JSON.stringify(SAMPLE));
  const cases = [
    ["untouched record passes", clone(), 0],
    ["payload tampered", (() => { const r = clone(); r.payloadCanonical = '{"idem":"test","n":2}'; return r; })(), 1],
    ["hash tampered", (() => { const r = clone(); r.payloadHash = "0".repeat(64); return r; })(), 1],
    ["signature tampered", (() => { const r = clone(); r.ed25519.signature = "0".repeat(128); return r; })(), 1],
    ["public key swapped", (() => { const r = clone(); r.ed25519.publicKey = "1".repeat(64); return r; })(), 1],
    ["revoked record", (() => { const r = clone(); r.revoked = true; return r; })(), 1],
    ["signature missing", (() => { const r = clone(); delete r.ed25519; return r; })(), 1],
  ];

  let bad = 0;
  for (const [name, record, mustFail] of cases) {
    const problems = checkRecord(record, null);
    const failed = problems.length > 0 ? 1 : 0;
    const verdict = failed === mustFail ? "ok" : "WRONG";
    if (verdict === "WRONG") bad++;
    console.log(`${verdict.padEnd(5)} ${name.padEnd(26)} ${problems.join("; ") || "(no problems)"}`);
  }
  /*
   * Controls for the file tie. These craft a record whose signature will NOT
   * verify (we hold no private key here), so they assert on the SPECIFIC
   * problem string instead of on pass/fail — otherwise they would be green
   * for the wrong reason, which is the failure this script exists to prevent.
   */
  const tmp = join(tmpdir(), `aevion-selftest-${process.pid}.bin`);
  const bytes = Buffer.from("the quick brown fox");
  writeFileSync(tmp, bytes);
  const trueHash = createHash("sha256").update(bytes).digest("hex");
  const recordFor = (hash) => {
    const canonical = JSON.stringify({ sha256: hash });
    return {
      payloadCanonical: canonical,
      payloadHash: createHash("sha256").update(canonical, "utf8").digest("hex"),
      revoked: false,
      ed25519: { publicKey: "0".repeat(64), signature: "0".repeat(128) },
    };
  };
  const said = (problems, needle) => problems.some((x) => x.includes(needle));

  const tieCases = [
    ["matching file not flagged", !said(checkRecord(recordFor(trueHash), null, tmp), "NOT the signed one")],
    ["wrong file IS flagged", said(checkRecord(recordFor("ab".repeat(32)), null, tmp), "NOT the signed one")],
    ["payload without sha256 flagged", said(checkRecord(SAMPLE, null, tmp), "names no sha256")],
    ["missing file on disk flagged", said(checkRecord(recordFor(trueHash), null, tmp + ".nope"), "cannot read")],
  ];
  for (const [name, pass] of tieCases) {
    if (!pass) bad++;
    console.log(`${pass ? "ok   " : "WRONG"} ${name}`);
  }
  try { unlinkSync(tmp); } catch {}
  const total = cases.length + tieCases.length;

  console.log(`\nself-test: ${total - bad} of ${total} as expected`);
  process.exit(bad === 0 ? 0 : 1);
}

/*
 * Run the CLI only when this file is the entry point. Without this, merely
 * importing checkRecord() from another script executed main() and printed
 * the usage line — which is exactly what happened the first time demo-local
 * imported it. A module that acts when you merely look at it is a trap for
 * whoever integrates it, and a buyer integrating it is the whole point.
 */
const запущенНапрямую = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;
if (запущенНапрямую) main();
