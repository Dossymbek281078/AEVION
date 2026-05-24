// Full-codebase i18n coverage audit: for every page.tsx, count hardcoded
// Russian strings vs t() / i18n key references. Reports rank-ordered list
// of worst offenders.
//
// Heuristics:
//   hardcodedRu = lines that contain at least one Cyrillic char AND
//                 aren't comments/imports/types and look like user-facing
//                 (JSX text, prop values, string literals).
//   iKeyCalls   = count of t("..."), useT(), useCcI18n(), <FormattedMessage,
//                 i18n key references like ".title" lookups.
//
// Run: node scripts/i18n-coverage-audit.mjs [--limit=30] [--min-strings=3]

import fs from "node:fs";
import path from "node:path";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=(.+)$/);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ""), true];
  }),
);
const LIMIT = Number(args.limit || 30);
const MIN_STRINGS = Number(args["min-strings"] || 3);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name === "page.tsx") out.push(p);
  }
  return out;
}

const ROOT = "frontend/src/app";
const files = walk(ROOT);

const CYRILLIC = /[А-ЯЁа-яё]/;
const T_CALL = /\bt\s*\(\s*["'`]/g;
const I18N_HOOK = /useT\b|useCcI18n\b|useTranslations\b|FormattedMessage|\buseI18n\b/g;

const rows = [];

for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  const lines = src.split("\n");
  let hardcoded = 0;
  let visibleSamples = [];
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    // skip comments/imports/types
    if (/^\s*(\/\/|\*|\/\*|import |export type|type |interface )/.test(L)) continue;
    if (!CYRILLIC.test(L)) continue;
    // strip comment portion of line
    const codeOnly = L.replace(/\/\/.*$/, "");
    if (!CYRILLIC.test(codeOnly)) continue;
    hardcoded += 1;
    if (visibleSamples.length < 3) {
      const m = codeOnly.match(/[А-ЯЁ][А-ЯЁа-яё\s.,!?:;\-–—()«»""'']{4,}/);
      if (m) visibleSamples.push(m[0].slice(0, 60));
    }
  }
  const tCalls = (src.match(T_CALL) || []).length;
  const hasI18nHook = I18N_HOOK.test(src);
  if (hardcoded < MIN_STRINGS) continue;
  rows.push({
    file: file.replace(/\\/g, "/").replace(/^frontend\/src\/app\//, ""),
    hardcoded,
    tCalls,
    hasI18nHook,
    samples: visibleSamples,
  });
}

rows.sort((a, b) => b.hardcoded - a.hardcoded);

const total = rows.length;
const totalHardcoded = rows.reduce((s, r) => s + r.hardcoded, 0);
const totalTCalls = rows.reduce((s, r) => s + r.tCalls, 0);
const pagesWithI18nHook = rows.filter((r) => r.hasI18nHook).length;

console.log(`\n=== AEVION i18n coverage audit ===`);
console.log(`Total page.tsx files: ${files.length}`);
console.log(`Pages with ≥${MIN_STRINGS} hardcoded RU lines: ${total}`);
console.log(`Pages using i18n hooks (t/useT/etc): ${pagesWithI18nHook}`);
console.log(`Sum hardcoded lines: ${totalHardcoded}`);
console.log(`Sum t() calls: ${totalTCalls}`);
console.log(`Ratio t() / hardcoded: ${(totalTCalls / Math.max(totalHardcoded, 1)).toFixed(2)}\n`);

console.log(`=== Top ${LIMIT} offenders (by hardcoded line count) ===\n`);
for (const r of rows.slice(0, LIMIT)) {
  const hookFlag = r.hasI18nHook ? "✓hook" : " no-hook";
  console.log(`${String(r.hardcoded).padStart(4)} hardcoded · ${String(r.tCalls).padStart(3)} t() · ${hookFlag} · ${r.file}`);
  if (r.samples[0]) console.log(`     e.g. "${r.samples[0]}"`);
}

// Cross-cut summary by domain (top-level dir under app/)
const byDomain = {};
for (const r of rows) {
  const dom = r.file.split("/")[0];
  byDomain[dom] = byDomain[dom] || { pages: 0, hardcoded: 0, tCalls: 0 };
  byDomain[dom].pages += 1;
  byDomain[dom].hardcoded += r.hardcoded;
  byDomain[dom].tCalls += r.tCalls;
}
const domRows = Object.entries(byDomain)
  .map(([dom, s]) => ({ dom, ...s }))
  .sort((a, b) => b.hardcoded - a.hardcoded);

console.log(`\n=== Domains ranked by hardcoded RU load ===\n`);
for (const d of domRows.slice(0, 25)) {
  console.log(`${String(d.hardcoded).padStart(5)} hardcoded · ${String(d.tCalls).padStart(4)} t() · ${String(d.pages).padStart(3)} pages · /${d.dom}`);
}
