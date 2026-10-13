#!/usr/bin/env node
/*
 * demo-local.mjs — end-to-end demonstration of the delivery format, offline.
 *
 * WHY THIS EXISTS, and what it is NOT.
 *
 * `manifest-sample.json` points at five REAL AEVION production signatures, but
 * those sign small test payloads, not file deliveries — so they cannot show you
 * the one thing a buyer cares about most: that a signature is tied to the bytes
 * you received. This script shows that part, end to end, in ten seconds.
 *
 * 🔴 The signatures it produces are NOT AEVION signatures. The keypair is
 * generated on YOUR machine, used once, and discarded. Nothing is sent
 * anywhere, nothing is registered, and the result proves nothing about any
 * real work. It demonstrates the FORMAT and the verifier, nothing else.
 *
 *   node demo-local.mjs
 *
 * Exit codes: 0 the demonstration behaved exactly as described, 1 it did not.
 */

import { generateKeyPairSync, sign as cryptoSign, createHash, randomUUID } from "node:crypto";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkRecord } from "./verify-aevion.mjs";
import { canonicalJson, payloadForFile } from "./bundle-aevion.mjs";

const dir = mkdtempSync(join(tmpdir(), "aevion-demo-"));
const files = [
  { name: "manuscript-01.txt", body: "The first chapter, as delivered.\n" },
  { name: "manuscript-02.txt", body: "The second chapter, as delivered.\n" },
  { name: "cover.svg", body: "<svg xmlns='http://www.w3.org/2000/svg'/>\n" },
];

/* One throwaway keypair, generated here, never stored. */
const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const publicHex = publicKey.export({ format: "der", type: "spki" }).subarray(-32).toString("hex");

const записи = [];
for (const f of files) {
  const path = join(dir, f.name);
  writeFileSync(path, f.body);
  const bytes = Buffer.byteLength(f.body);
  const sha256 = createHash("sha256").update(f.body).digest("hex");
  const payload = payloadForFile({ file: f.name, bytes, sha256 }, "demo-delivery");
  const canonical = canonicalJson(payload);
  записи.push({
    file: f.name,
    localFile: path,
    record: {
      id: randomUUID(),
      payloadCanonical: canonical,
      payloadHash: createHash("sha256").update(canonical, "utf8").digest("hex"),
      revoked: false,
      ed25519: {
        kid: "demo-local-throwaway",
        publicKey: publicHex,
        signature: cryptoSign(null, Buffer.from(canonical, "utf8"), privateKey).toString("hex"),
      },
    },
  });
}

console.log("A three-file delivery, signed locally with a throwaway key.\n");
let ошибок = 0;

for (const з of записи) {
  const problems = checkRecord(з.record, publicHex, з.localFile);
  console.log(`${(problems.length === 0 ? "OK" : "FAIL").padEnd(7)}  ${з.file}  ${problems.join("; ")}`);
  if (problems.length !== 0) ошибок++;
}

/*
 * The negative half, and it is the half that matters. A verifier that says OK
 * to everything proves nothing, so we now corrupt one delivered file on disk —
 * exactly what a man in the middle, a bad mirror or a careless copy would do —
 * and the same check must refuse it.
 */
console.log("\nNow one file is altered after signing (one byte appended):");
const жертва = записи[0];
writeFileSync(жертва.localFile, files[0].body + "x");
const после = checkRecord(жертва.record, publicHex, жертва.localFile);
const поймано = после.some((p) => p.includes("NOT the signed one"));
/*
 * Столбец статуса обязан значить ОДНО И ТО ЖЕ про файл во всём выводе.
 * Было: при ПОЙМАННОЙ подмене печаталось "OK" — потому что выполнилось
 * ожидание ДЕМО. В одном выводе один знак говорил про файл обратное: три
 * "OK" = проверен, четвёртое "OK" = отвергнут. Покупатель, пробегающий
 * глазами столбец, читает это как "подмену не заметили" — то есть наш
 * собственный вывод оспаривает ровно то, что мы им продаём.
 * Теперь про файл печатается ЕГО вердикт, ожидание демо — отдельной строкой.
 */
console.log(`${(поймано ? "REFUSED" : "ACCEPTED").padEnd(7)}  ${жертва.file}  ${после.join("; ")}`);
console.log(
  поймано
    ? '         expected: an altered file must be refused — it was'
    : '         NOT REFUSED — this demo failed to catch the alteration',
);
if (!поймано) ошибок++;

console.log("\nAnd the signature alone still verifies — which is the point:");
console.log("  a valid signature does NOT mean the file you hold is the signed one.");
console.log("  Only passing your local copy to the verifier establishes that.");

rmSync(dir, { recursive: true, force: true });
console.log(`\ndemonstration: ${ошибок === 0 ? "behaved exactly as described" : "DID NOT behave as described"}`);
process.exitCode = ошибок === 0 ? 0 : 1;
