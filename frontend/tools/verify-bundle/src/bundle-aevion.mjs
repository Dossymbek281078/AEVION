#!/usr/bin/env node
/*
 * bundle-aevion.mjs — prepare a delivery for signing, and assemble the manifest.
 *
 * WHY. verify-aevion.mjs answers the buyer's question. This answers ours: it
 * turns a folder of files into the exact payloads we sign, so that what the
 * buyer later verifies is tied to the bytes they received — not to a record
 * that merely exists.
 *
 * TWO STEPS, deliberately separate.
 *   1. node bundle-aevion.mjs prepare <folder> --out <dir>
 *      Hashes every file and writes `to-sign.json` (one payload per file) and
 *      a manifest skeleton. Touches nothing but the output directory, makes no
 *      network call, and signs nothing.
 *   2. node bundle-aevion.mjs attach <dir> --signed <signed.json>
 *      Merges the signature ids returned by POST /api/qsign/v2/sign into the
 *      manifest, so verify-aevion.mjs can check it.
 *
 * The signing call itself is NOT in this script on purpose: it needs a
 * credential and it writes to production. A tool that can quietly do both is
 * a tool that will one day do both by accident.
 *
 * EXIT CODES: 0 done, 1 refused with a reason, 2 could not run.
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";

/** RFC 8785 (JCS) canonical JSON — must match the server byte for byte. */
export function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  const keys = Object.keys(value).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalJson(value[k])).join(",") + "}";
}

export function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function walk(dir, root = dir, acc = []) {
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, root, acc);
    else acc.push({ file: relative(root, full).split(sep).join("/"), bytes: st.size, full });
  }
  return acc;
}

/**
 * The payload we sign for one file.
 *
 * Only facts we can stand behind go in here. There is no `author` field and no
 * `consent` field: we do not verify identity today and consent-to-train is not
 * built, so signing either would be signing a claim we cannot support — the
 * exact thing the signature is supposed to prevent.
 */
export function payloadForFile(entry, delivery) {
  return {
    bytes: entry.bytes,
    delivery: delivery,
    file: entry.file,
    kind: "aevion.delivery.file.v1",
    sha256: entry.sha256,
  };
}

function prepare(folder, outDir, deliveryName) {
  let files;
  try {
    files = walk(folder);
  } catch (e) {
    console.error(`cannot read ${folder}: ${e.message}`);
    process.exitCode = 2;
    return;
  }
  if (files.length === 0) {
    console.error("no files found — nothing to prepare");
    process.exitCode = 1;
    return;
  }
  mkdirSync(outDir, { recursive: true });

  const payloads = [];
  for (const entry of files) {
    entry.sha256 = sha256File(entry.full);
    const payload = payloadForFile(entry, deliveryName);
    payloads.push({ file: entry.file, payload, canonical: canonicalJson(payload) });
  }

  writeFileSync(join(outDir, "to-sign.json"), JSON.stringify({ delivery: deliveryName, payloads }, null, 2) + "\n");
  writeFileSync(
    join(outDir, "manifest.json"),
    JSON.stringify(
      {
        note: "ids are empty until `attach` runs — verify-aevion.mjs will refuse this file as is",
        apiBase: "https://api.aevion.app",
        publicKey: null,
        records: payloads.map((p) => ({ file: p.file, id: null, sha256: p.payload.sha256 })),
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`prepared ${payloads.length} file(s) from ${folder}`);
  console.log(`  ${join(outDir, "to-sign.json")}   — POST each payload to /api/qsign/v2/sign`);
  console.log(`  ${join(outDir, "manifest.json")}  — ids still empty`);
}

/**
 * Вложить подписанные записи прямо в манифест.
 *
 * ПОВОД 12.10.2026. Проба соседнего окна подменила `apiBase` на несуществующий
 * хост — и проверка образца упала на ВСЕХ пяти записях: манифест нёс только
 * id, а сами подписи тянулись с api.aevion.app. Письма при этом обещали
 * покупателю проверку без обращения к нашим системам. Такое обещание чинится
 * не текстом, а здесь: сеть оплачивается ОДИН раз, на нашей стороне, при
 * сборке поставки. Покупателю она больше не нужна вовсе.
 *
 * Возвращает число записей, у которых подпись лежит в манифесте.
 */
export async function вложитьЗаписи(manifest, apiBase, fetchFn = fetch) {
  let вложено = 0;
  for (const rec of manifest.records || []) {
    if (rec.record && rec.record.ed25519 && rec.record.ed25519.signature) {
      вложено++;
      continue; // уже вложена — лишний запрос к проду не делаем
    }
    if (!rec.id) continue;
    try {
      const r = await fetchFn(`${apiBase}/api/qsign/v2/${rec.id}/public`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const тело = await r.json();
      if (!(тело && тело.ed25519 && тело.ed25519.signature)) throw new Error("ответ без подписи");
      rec.record = тело;
      вложено++;
    } catch (e) {
      console.log(`could not embed ${rec.file || rec.id}: ${e.message}`);
    }
  }
  return вложено;
}

async function attach(dir, signedPath, apiBase) {
  let manifest, signed;
  try {
    manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
    signed = JSON.parse(readFileSync(signedPath, "utf8"));
  } catch (e) {
    console.error(`cannot read inputs: ${e.message}`);
    process.exitCode = 2;
    return;
  }
  const byFile = new Map((signed.results || []).map((r) => [r.file, r]));
  let missing = 0;
  for (const rec of manifest.records) {
    const r = byFile.get(rec.file);
    if (!r || !r.id) {
      missing++;
      continue;
    }
    rec.id = r.id;
    if (r.record) rec.record = r.record;
  }
  if (signed.publicKey) manifest.publicKey = signed.publicKey;
  delete manifest.note;
  /* Поставка без вложенных записей заставляет покупателя обращаться к нам —
   * ровно то, чего мы обещали не требовать. Поэтому это не предупреждение. */
  const вложено = await вложитьЗаписи(manifest, apiBase || "https://api.aevion.app");
  manifest.checkedAt = new Date().toISOString().slice(0, 10);
  writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log(`attached ${manifest.records.length - missing} of ${manifest.records.length} id(s)`);
  console.log(`embedded ${вложено} of ${manifest.records.length} signed record(s) — a delivery with fewer needs network access to us`);
  if (вложено < manifest.records.length) process.exitCode = 1;
  if (missing > 0) {
    console.log(`${missing} record(s) still have no id — the manifest is incomplete`);
    process.exitCode = 1;
  }
}

async function selftest() {
  const cases = [];
  const ok = (name, cond) => cases.push([name, cond]);

  /* The canonical form must match the server's, or every signature we produce
   * verifies against nothing. Key order and the absence of whitespace are the
   * whole point, so both are controlled here. */
  ok("keys are sorted", canonicalJson({ b: 1, a: 2 }) === '{"a":2,"b":1}');
  ok("no whitespace", canonicalJson({ a: [1, 2] }) === '{"a":[1,2]}');
  ok("nested objects sorted", canonicalJson({ b: { d: 1, c: 2 } }) === '{"b":{"c":2,"d":1}}');
  ok("matches a real production payload", canonicalJson({ idem: "test", n: 1 }) === '{"idem":"test","n":1}');

  /* Negative controls: the payload must change when the bytes change, and must
   * NOT change when nothing does. A hash that ignores content would make every
   * delivery verify and prove nothing. */
  const a = payloadForFile({ file: "x.bin", bytes: 3, sha256: "aa" }, "d1");
  const b = payloadForFile({ file: "x.bin", bytes: 3, sha256: "bb" }, "d1");
  const c = payloadForFile({ file: "x.bin", bytes: 3, sha256: "aa" }, "d1");
  ok("different content -> different payload", canonicalJson(a) !== canonicalJson(b));
  ok("same input -> identical payload", canonicalJson(a) === canonicalJson(c));
  ok("renaming the file changes the payload",
     canonicalJson(a) !== canonicalJson(payloadForFile({ file: "y.bin", bytes: 3, sha256: "aa" }, "d1")));
  ok("we never sign an author claim", !("author" in a) && !("consent" in a));


  /* Вложение записей — обещание «проверка без обращения к нам». Проверяется
   * тремя случаями, и два из них отрицательные: иначе зелёный цвет значил бы
   * только «функция вызвалась». */
  const подпись = { ed25519: { signature: "ab".repeat(64), publicKey: "cd".repeat(32) } };
  const манифест1 = { records: [{ file: "a.bin", id: "id-1" }] };
  const вложено1 = await вложитьЗаписи(манифест1, "https://x.example", async () => ({
    ok: true,
    json: async () => подпись,
  }));
  ok(
    "запись вкладывается в манифест",
    вложено1 === 1 && манифест1.records[0].record?.ed25519?.signature === подпись.ed25519.signature,
  );

  const манифест2 = { records: [{ file: "a.bin", id: "id-1" }] };
  const вложено2 = await вложитьЗаписи(манифест2, "https://x.example", async () => {
    throw new Error("сеть молчит");
  });
  ok("молчащая сеть даёт НОЛЬ вложенных, а не вид успеха", вложено2 === 0 && !манифест2.records[0].record);

  let запросов = 0;
  const манифест3 = { records: [{ file: "a.bin", id: "id-1", record: подпись }] };
  const вложено3 = await вложитьЗаписи(манифест3, "https://x.example", async () => {
    запросов++;
    throw new Error("не должно вызываться");
  });
  ok("уже вложенную запись не перезапрашивает", вложено3 === 1 && запросов === 0);

  let bad = 0;
  for (const [name, pass] of cases) {
    if (!pass) bad++;
    console.log(`${pass ? "ok   " : "WRONG"} ${name}`);
  }
  console.log(`\nself-test: ${cases.length - bad} of ${cases.length} as expected`);
  process.exitCode = bad === 0 ? 0 : 1;
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

const [, , cmd, ...rest] = process.argv;
const flag = (name) => {
  const i = rest.indexOf(name);
  return i >= 0 ? rest[i + 1] : undefined;
};

if (!запущенНапрямую) {
  /* imported for canonicalJson/payloadForFile — do nothing */
} else if (cmd === "--selftest") selftest();
else if (cmd === "prepare") prepare(rest[0], flag("--out") || "./delivery", flag("--name") || "delivery-" + new Date().toISOString().slice(0, 10));
else if (cmd === "attach") attach(rest[0], flag("--signed"), flag("--api"));
else {
  console.error("usage: bundle-aevion.mjs prepare <folder> --out <dir> [--name <delivery>]");
  console.error("       bundle-aevion.mjs attach <dir> --signed <signed.json> [--api <base>]");
  console.error("       bundle-aevion.mjs --selftest");
  process.exitCode = 2;
}
