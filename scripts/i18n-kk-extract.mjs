// Audit i18n parity across en/ru/kk in frontend/src/lib/i18n-data.ts.
// Checks the main `translations` block AND all EXTRA blocks.
// Run any time new EN keys are added.
// Exit 1 if any key is missing in RU or KK.

import fs from "node:fs";

const src = fs.readFileSync("frontend/src/lib/i18n-data.ts", "utf8");
const lines = src.split("\n");

// ── helpers ────────────────────────────────────────────────────────────────

function extractKeysFromBlock(startLine, endLine) {
  const keys = new Set();
  const keyRe = /^\s+"([^"]+)":/;
  for (let i = startLine + 1; i < endLine; i++) {
    const m = lines[i].match(keyRe);
    if (m) keys.add(m[1]);
  }
  return keys;
}

function checkParity(label, en, ru, kk) {
  const missingRu = [...en].filter((k) => !ru.has(k));
  const missingKk = [...en].filter((k) => !kk.has(k));
  const status = missingRu.length === 0 && missingKk.length === 0 ? "✓" : "✗";
  console.log(
    `${status} ${label.padEnd(30)} EN=${en.size}  RU=${ru.size}  KK=${kk.size}` +
      (missingRu.length ? `  missing-RU=${missingRu.length}` : "") +
      (missingKk.length ? `  missing-KK=${missingKk.length}` : "")
  );
  if (missingRu.length) {
    for (const k of missingRu) console.log(`    RU missing: ${k}`);
  }
  if (missingKk.length) {
    for (const k of missingKk) console.log(`    KK missing: ${k}`);
  }
  return missingRu.length + missingKk.length;
}

// ── 1. Main `translations` block ──────────────────────────────────────────

const tStart = lines.findIndex((l) => /^export const translations/.test(l));
const tEnd = lines.findIndex((l, i) => i > tStart && /^\};/.test(l));

let cur = null;
const mainBlocks = {};
const langRe = /^\s{2}(en|ru|kk):\s*\{/;
const keyRe = /^\s+"([^"]+)":/;

for (let i = tStart + 1; i < tEnd; i++) {
  const langM = lines[i].match(langRe);
  if (langM) { cur = { lang: langM[1], keys: new Set() }; mainBlocks[langM[1]] = cur; continue; }
  if (cur) {
    if (/^\s{2}\},/.test(lines[i])) { cur = null; continue; }
    const k = lines[i].match(keyRe);
    if (k) cur.keys.add(k[1]);
  }
}

let totalMissing = 0;

totalMissing += checkParity(
  "translations (main)",
  mainBlocks.en?.keys ?? new Set(),
  mainBlocks.ru?.keys ?? new Set(),
  mainBlocks.kk?.keys ?? new Set()
);

// ── 2. EXTRA blocks — each prefix has _EN / _RU / _KK ────────────────────

const EXTRA_PREFIXES = [
  "BANK_EXTRA",
  "AWARDS_EXTRA",
  "HELP_EXTRA",
  "AWARDS_PORTAL_EXTRA",
  "AWARDS_TRACK_PANEL_EXTRA",
  "PLANET_ARTIFACT_EXTRA",
  "AWARDS_HUB_EXTRA",
  "MODULE_PAGE_EXTRA",
];

for (const prefix of EXTRA_PREFIXES) {
  const langs = {};
  for (const lang of ["EN", "RU", "KK"]) {
    const constName = `${prefix}_${lang}`;
    const startIdx = lines.findIndex((l) => l.startsWith(`const ${constName}:`));
    if (startIdx === -1) { langs[lang] = new Set(); continue; }
    // find matching closing `};`
    let depth = 0;
    let endIdx = startIdx;
    for (let i = startIdx; i < lines.length; i++) {
      for (const ch of lines[i]) {
        if (ch === "{") depth++;
        else if (ch === "}") { depth--; if (depth === 0) { endIdx = i; break; } }
      }
      if (depth === 0) break;
    }
    langs[lang] = extractKeysFromBlock(startIdx, endIdx);
  }
  totalMissing += checkParity(
    prefix,
    langs.EN,
    langs.RU,
    langs.KK
  );
}

// ── summary ────────────────────────────────────────────────────────────────

console.log("");
if (totalMissing === 0) {
  console.log("All i18n blocks are in parity (EN=RU=KK). ✓");
} else {
  console.log(`FAIL: ${totalMissing} missing translations across all blocks.`);
  process.exit(1);
}
