import fs from "node:fs";

const src = fs.readFileSync("frontend/src/lib/i18n.tsx", "utf8");
const lines = src.split("\n");
const tStart = lines.findIndex((l) => /^export const translations/.test(l));
const tEnd = lines.findIndex((l, i) => i > tStart && /^\};/.test(l));

let cur = null;
const blocks = {};
const keyRe = /^\s+"([^"]+)":\s*"((?:[^"\\]|\\.)*)"/;

for (let i = tStart + 1; i < tEnd; i++) {
  const langM = lines[i].match(/^\s{2}(en|ru|kk):\s*\{/);
  if (langM) {
    cur = { lang: langM[1], map: new Map() };
    blocks[langM[1]] = cur;
    continue;
  }
  if (cur) {
    if (/^\s{2}\},/.test(lines[i])) {
      cur = null;
      continue;
    }
    const k = lines[i].match(keyRe);
    if (k) cur.map.set(k[1], k[2]);
  }
}

const en = blocks.en.map;
const ru = blocks.ru.map;
const kk = blocks.kk.map;
const missing = [...en.keys()].filter((k) => !kk.has(k));
console.log(JSON.stringify(missing.map((k) => ({ key: k, en: en.get(k), ru: ru.get(k) })), null, 2));
