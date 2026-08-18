import fs from "node:fs";
import path from "node:path";

const ROOT = "src/lib/qventure";
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) walk(f);
    else if (f.endsWith(".ts")) files.push(f);
  }
})(ROOT);

const SEP = String.fromCharCode(10);
const norm = (l) => l.replace(new RegExp("//.*$"), "").replace(/\s+/g, " ").trim();
const WINDOW = 3;
const seen = new Map();

for (const f of files) {
  const lines = fs.readFileSync(f, "utf8").split(SEP).map(norm);
  for (let i = 0; i + WINDOW <= lines.length; i++) {
    const win = lines.slice(i, i + WINDOW);
    if (win.some((l) => l.length < 12)) continue;
    const key = win.join(SEP);
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key).push(f + ":" + (i + 1));
  }
}

const dups = [...seen.entries()].filter(([, at]) => at.length > 1);
console.log("files: " + files.length + " | duplicate " + WINDOW + "-line blocks: " + dups.length);
for (const [key, at] of dups.slice(0, 20)) {
  console.log("");
  console.log("-- " + at.join("  <->  "));
  for (const l of key.split(SEP)) console.log("     " + l.slice(0, 105));
}
