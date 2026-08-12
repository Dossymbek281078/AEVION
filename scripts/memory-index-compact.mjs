#!/usr/bin/env node
/**
 * Shortens over-long lines in the shared memory index.
 *
 * Measured 2026-08-12: `~/.claude/projects/C--Users-user-aevion-core/memory/
 * MEMORY.md` was 60 489 bytes against a 24 400 limit, average line 413 chars
 * against a ~200 guideline, and **half the file was written that single day**.
 * Only part of an oversized index is loaded, and new lines sit at the end —
 * so the newest knowledge is the first to stop surfacing. An index that eats
 * its own tail is worse than a short one.
 *
 * WHY THIS IS A SCRIPT AND NOT AN EDIT I MADE
 * The file is append-only by house rule: several sessions write it in
 * parallel, and a whole-file rewrite has already lost three lines once. This
 * rewrites the whole file, so it must run when no other session is writing —
 * that is a call for a human, not for a tab that cannot see the others.
 *
 * Usage:
 *   node scripts/memory-index-compact.mjs                 # dry run, writes nothing
 *   node scripts/memory-index-compact.mjs --apply         # rewrites, after a backup
 *   node scripts/memory-index-compact.mjs --apply --max 180
 *
 * What it preserves, without exception:
 *   - every line, in order — nothing is dropped, only shortened;
 *   - the `[Title](file.md)` link, which is how a memory is found at all;
 *   - the em-dash hook, truncated at a word boundary with an ellipsis.
 * A line already within the limit is returned byte-identical.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const INDEX = path.join(
  os.homedir(),
  ".claude", "projects", "C--Users-user-aevion-core", "memory", "MEMORY.md",
);

const apply = process.argv.includes("--apply");
const maxIdx = process.argv.indexOf("--max");
const MAX = maxIdx === -1 ? 200 : Number(process.argv[maxIdx + 1]) || 200;

if (!fs.existsSync(INDEX)) {
  console.error(`index not found: ${INDEX}`);
  process.exit(1);
}

const original = fs.readFileSync(INDEX, "utf8");
const lines = original.split(/\r?\n/);

/** Keeps `- [Title](file.md) — hook`, trimming only the hook. */
function shorten(line) {
  if (line.length <= MAX) return line;
  const link = line.match(/^-\s*\[[^\]]*\]\([^)]*\)/);
  if (!link) return line; // not an index entry — leave it alone
  const head = link[0];
  const rest = line.slice(head.length).replace(/^\s*[—-]\s*/, "");
  const room = MAX - head.length - 4; // " — " plus the ellipsis
  if (room <= 20) return line; // nothing meaningful would survive
  let hook = rest.slice(0, room);
  const lastSpace = hook.lastIndexOf(" ");
  if (lastSpace > room * 0.6) hook = hook.slice(0, lastSpace);
  return `${head} — ${hook}…`;
}

const out = lines.map(shorten);
const before = Buffer.byteLength(original, "utf8");
const after = Buffer.byteLength(out.join("\n"), "utf8");
const touched = out.filter((l, i) => l !== lines[i]).length;

console.log(`index : ${INDEX}`);
console.log(`lines : ${lines.length} (${touched} would be shortened, 0 dropped)`);
console.log(`bytes : ${before} → ${after} (${Math.round((1 - after / before) * 100)}% smaller)`);

if (!apply) {
  console.log("\nDry run — nothing written. Re-run with --apply when no other");
  console.log("session is writing the index; a .bak copy is taken first.");
  const sample = out.findIndex((l, i) => l !== lines[i]);
  if (sample !== -1) {
    console.log(`\nexample, line ${sample + 1}:`);
    console.log(`  before: ${lines[sample].slice(0, 120)}…`);
    console.log(`  after : ${out[sample]}`);
  }
  process.exit(0);
}

const backup = `${INDEX}.${new Date().toISOString().replace(/[:.]/g, "-")}.bak`;
fs.writeFileSync(backup, original, "utf8");
fs.writeFileSync(INDEX, out.join("\n"), "utf8");
console.log(`\nwritten. backup: ${backup}`);
