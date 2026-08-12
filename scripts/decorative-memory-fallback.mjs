#!/usr/bin/env node
/**
 * Finds in-memory fallbacks that nobody reads back.
 *
 * The shape: a route catches a database write failure and parks the value in a
 * `mem*` Map, but the matching reader consults that Map only inside a
 * `if (!isSomethingDbReady())` branch. With the database nominally up — which
 * is the case whenever a single write fails — the parked copy is never read.
 * The write is lost, and the route has already answered 200/201.
 *
 * It is silent by construction: no error, no log line, and the code reads as if
 * it has a safety net.
 *
 * Found five times in DevHub on 2026-08-12, in rising order of cost:
 *   memUsage   → quota metering vanished; every paid limit opened
 *   memTiers   → a paying customer lost their plan for the duration
 *   memProjects→ a project the user just created was not there afterwards
 *   memCheckpoints → undo restored an OLDER snapshot over the user's work
 *   memDeployments → a deploy (including an honest 501 refusal) left no trace
 *
 * Usage:  node scripts/decorative-memory-fallback.mjs [dir]
 * Exit 0 always — this is a lead generator, not a gate. Every hit needs a human
 * to answer one question: is the read reachable with a live database?
 *
 * Known false positive: a real read-through cache (qreal.ts's
 * memStoryboardCache) writes near a catch but reads unconditionally at the top
 * of its function. Judge by whether the read is on the ordinary path, not by
 * the shape of the write.
 */

import fs from "node:fs";
import path from "node:path";

const dir = process.argv[2] ?? "aevion-globus-backend/src/routes";

if (!fs.existsSync(dir)) {
  console.error(`no such directory: ${dir}`);
  process.exit(0);
}

/**
 * "Anything but a closing brace" keeps the match inside the catch block, which
 * is what makes the output worth reading — widening it to any character took
 * the list from 5 hits to 32, most of them a `catch {}` followed much later by
 * an unrelated write.
 *
 * But the strict form silently missed `memUsage`, the very case this pattern
 * was first found in: its catch body builds a key from a template literal, and
 * `${userId}:${month}` closes a brace before the `.set(` is reached. So the
 * interpolations are removed first (see `stripComments`), and the window stays
 * strict.
 */
const CATCH_WRITE = /catch[^{]*\{[^}]{0,400}?\b(mem[A-Za-z0-9_]*)\s*\.set\(/gs;
const READ_SUFFIXES = [".get(", ".values(", ".has(", ".find("];

/**
 * Comments describe the pattern more often than the code uses it — the first
 * run of this script reported `memFiles`, and the only hit was a JSDoc block
 * explaining that the pattern had been REMOVED. A grep that finds a thing
 * inside a comment saying the thing is not there is a lie in the confident
 * direction, so strip comments before matching.
 *
 * Line comments are dropped only when the line begins with `//` or `*`, which
 * leaves a trailing `https://…` inside a string alone.
 */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split(/\r?\n/)
    .filter((line) => !/^\s*(\/\/|\*)/.test(line))
    .join("\n")
    // `${...}` carries braces that would end the search window early; the
    // contents never matter to this scan, so collapse them to a placeholder.
    .replace(/\$\{[^{}]*\}/g, "$_");
}

/** Counts occurrences without building a regex out of an identifier. */
function countReads(source, name) {
  let n = 0;
  for (const suffix of READ_SUFFIXES) {
    let i = 0;
    for (;;) {
      const at = source.indexOf(name + suffix, i);
      if (at === -1) break;
      n++;
      i = at + 1;
    }
  }
  return n;
}

const rows = [];
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".ts"))) {
  const source = stripComments(fs.readFileSync(path.join(dir, file), "utf8"));
  const names = new Set();
  let m;
  CATCH_WRITE.lastIndex = 0;
  while ((m = CATCH_WRITE.exec(source))) names.add(m[1]);
  for (const name of names) rows.push({ file, name, reads: countReads(source, name) });
}

if (rows.length === 0) {
  console.log("No in-catch memory fallbacks found.");
  process.exit(0);
}

console.log(`Maps written inside a catch (${rows.length}). For each, check the`);
console.log("reader: is it reachable when the database is UP?\n");
for (const r of rows) {
  console.log(`  ${r.file.padEnd(30)} ${r.name.padEnd(20)} reads: ${r.reads}`);
}
console.log("\nFix recipe (see memory bug_devhub_metering_vanishes_on_db_failure):");
console.log("  reader overlays the parked copy on top of the database row;");
console.log("  a successful write DELETES the parked copy;");
console.log("  deleting the entity clears both sides, or deleted rows resurrect.");
