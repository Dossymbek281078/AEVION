#!/usr/bin/env node
/**
 * Audit: setState called from inside a setInterval — the perf bug fixed today
 * across CyberChess (PR #721, #740, #746). Not a hard gate, just a flag-for-
 * -review scan: a component that owns a large render tree and setState's on
 * every tick forces the WHOLE tree to re-render every tick, for as long as
 * the interval runs. Small/isolated components ticking fast (e.g. a self-
 * contained countdown widget) are fine — the risk is scale, not frequency
 * alone, so every hit here needs a human to check "how big is the render
 * this setState triggers, and how long does the interval run for".
 *
 * Heuristic (regex, not a real AST parse — expect some noise either way):
 *   for every `setInterval(...)` call, grab its balanced-paren body text and
 *   flag it if that body calls something matching a useState setter naming
 *   convention (`setFoo(` or, as used throughout cyberchess/page.tsx, `sFoo(`).
 *
 * Usage: node scripts/audit-tick-setstate.mjs [root-dir]
 *   (default root: frontend/src)
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const root = process.argv[2] || "frontend/src";
const SETTER_RE = /\b(set[A-Z]\w*|s[A-Z]\w*)\s*\(/;
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", "build", ".git"]);
const EXTS = new Set([".ts", ".tsx"]);

function walk(dir, out) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (EXTS.has(extname(entry))) out.push(full);
  }
  return out;
}

// Given text and the index right after "setInterval(", return the substring
// up to (not including) the matching close paren, tracking nesting depth.
function extractBalanced(text, startIdx) {
  let depth = 1;
  let i = startIdx;
  while (i < text.length && depth > 0) {
    if (text[i] === "(") depth++;
    else if (text[i] === ")") depth--;
    i++;
  }
  return text.slice(startIdx, i - 1);
}

function lineOf(text, idx) {
  return text.slice(0, idx).split("\n").length;
}

function delayArgOf(body) {
  // crude: last top-level comma-separated arg, if it looks numeric/short
  const parts = body.split(",");
  const last = parts[parts.length - 1]?.trim();
  return /^\d+$/.test(last) ? `${last}ms` : "(non-literal delay)";
}

const files = walk(root, []);
const findings = [];

for (const file of files) {
  const text = readFileSync(file, "utf8");
  let searchFrom = 0;
  while (true) {
    const idx = text.indexOf("setInterval(", searchFrom);
    if (idx === -1) break;
    const bodyStart = idx + "setInterval(".length;
    const body = extractBalanced(text, bodyStart);
    if (SETTER_RE.test(body)) {
      findings.push({
        file,
        line: lineOf(text, idx),
        delay: delayArgOf(body),
        setter: body.match(SETTER_RE)[1],
      });
    }
    searchFrom = bodyStart;
  }
}

if (findings.length === 0) {
  console.log("No setInterval(...) call sites call a setState-shaped function. Clean.");
  process.exit(0);
}

console.log(`${findings.length} setInterval(...) call site(s) that setState — review each for render-tree size:\n`);
for (const f of findings) {
  console.log(`  ${f.file}:${f.line}  [${f.delay}]  calls ${f.setter}(...)`);
}
console.log("\nNot an auto-fail — a fast tick in a small, isolated component is fine.");
console.log("Red flag: the setInterval lives directly inside a large page-level component's own body.");
