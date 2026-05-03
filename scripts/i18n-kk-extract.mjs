// Audit i18n parity across en/ru/kk in frontend/src/lib/i18n-data.ts.
// Prints en/ru/kk key counts and lists keys missing from each non-en
// dictionary. Run any time new EN keys are added.

import fs from "node:fs";

const src = fs.readFileSync("frontend/src/lib/i18n-data.ts", "utf8");
const lines = src.split("\n");
const tStart = lines.findIndex((l) => /^export const translations/.test(l));
const tEnd = lines.findIndex((l, i) => i > tStart && /^\};/.test(l));

let cur = null;
const blocks = {};
const keyRe = /^\s+"([^"]+)":/;
const langRe = /^\s{2}(en|ru|kk):\s*\{/;

for (let i = tStart + 1; i < tEnd; i++) {
  const langM = lines[i].match(langRe);
  if (langM) {
    cur = { lang: langM[1], keys: new Set() };
    blocks[langM[1]] = cur;
    continue;
  }
  if (cur) {
    if (/^\s{2}\},/.test(lines[i])) {
      cur = null;
      continue;
    }
    const k = lines[i].match(keyRe);
    if (k) cur.keys.add(k[1]);
  }
}

const en = blocks.en?.keys ?? new Set();
const ru = blocks.ru?.keys ?? new Set();
const kk = blocks.kk?.keys ?? new Set();

const missingRu = [...en].filter((k) => !ru.has(k));
const missingKk = [...en].filter((k) => !kk.has(k));

console.log(`EN=${en.size}  RU=${ru.size}  KK=${kk.size}`);
console.log(`missing-RU=${missingRu.length}  missing-KK=${missingKk.length}`);

if (missingRu.length) {
  console.log("\nMissing in RU:");
  for (const k of missingRu) console.log("  " + k);
}
if (missingKk.length) {
  console.log("\nMissing in KK:");
  for (const k of missingKk) console.log("  " + k);
}

if (missingRu.length || missingKk.length) process.exit(1);
