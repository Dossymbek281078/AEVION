// Разовая правка 23.10.2026: добавить meter { module } во все вызовы callProvider/callProviderResilient без учёта.
// node scripts/add-meter-to-calls.mjs [--apply]   (без --apply — сухой прогон)
import fs from "node:fs";
import path from "node:path";
import { scanDir } from "./scan-unmetered-calls.mjs";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "src");
const APPLY = process.argv.includes("--apply");
const MODULE_BY_FILE = [
  [/routes\/devhub\.ts$/, "devhub-gen"], [/routes\/i18n\.ts$/, "i18n"], [/routes\/qcoreai\.ts$/, "qcoreai"],
  [/routes\/qjobs\.ts$/, "qjobs"], [/routes\/qlearn\.ts$/, "qlearn"], [/routes\/qmedia\.ts$/, "qmedia"],
  [/routes\/qreal\.ts$/, "qreal"], [/routes\/psyappDeps\.ts$/, "psyapp-deps"], [/lib\/дешёвыйИИ\.ts$/, "cheap-ai"],
  [/services\/qcoreai\/evalRunner\.ts$/, "qcoreai-eval"], [/services\/qcoreai\/orchestrator\.ts$/, "qcoreai-classifier"],
  [/services\/qcoreai\/store\.ts$/, "qcoreai-store"],
];
const moduleFor = (file) => (MODULE_BY_FILE.find(([re]) => re.test(file)) ?? [null, file.replace(/.*\//, "").replace(/\.ts$/, "")])[1];
// разбить аргументы по верхнему уровню (скобки/кавычки/шаблоны учитываются)
function splitArgs(s) {
  const out = []; let depth = 0, cur = "", q = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { cur += c; if (c === "\\") { cur += s[++i] ?? ""; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === "`") { q = c; cur += c; continue; }
    if ("([{".includes(c)) depth++; if (")]}".includes(c)) depth--;
    if (c === "," && depth === 0) { out.push(cur); cur = ""; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur);
  return out;
}
const unmetered = scanDir(ROOT).filter((c) => !c.metered);
const byFile = new Map();
for (const c of unmetered) { if (!byFile.has(c.file)) byFile.set(c.file, []); byFile.get(c.file).push(c); }
let changed = 0, skipped = 0;
for (const [file, calls] of byFile) {
  const p = path.join(ROOT, file); let src = fs.readFileSync(p, "utf8");
  // идём с конца файла, чтобы смещения не плыли
  const re = /\b(callProvider|callProviderResilient)\s*\(/g; const sites = [];
  let m; while ((m = re.exec(src))) { const before = src.slice(Math.max(0, m.index - 30), m.index); if (/function\s+$|export\s+async\s+function\s+$|\.\s*$/.test(before)) continue; let i = m.index + m[0].length, depth = 1; while (i < src.length && depth > 0) { const c = src[i]; if (c === "(") depth++; else if (c === ")") depth--; i++; } sites.push({ fn: m[1], start: m.index + m[0].length, end: i - 1 }); }
  for (const s of sites.reverse()) {
    const argsText = src.slice(s.start, s.end);
    if (/\bmodule\s*:/.test(argsText) || /\b(meter|метр|учёт)\w*\b/.test(argsText)) continue;
    const args = splitArgs(argsText);
    if (args.length < 3) { console.log(`  пропуск (не вызов?) ${file}: ${argsText.slice(0, 60)}`); skipped++; continue; }
    const meter = `{ module: "${moduleFor(file)}" }`;
    const pos = s.fn === "callProviderResilient" ? 4 : 6; // индекс аргумента meter
    const parts = args.map((a) => a.trimEnd());
    while (parts.length < pos) parts.push(" undefined");
    if (parts.length === pos) parts.push(" " + meter);
    else if (/^\s*undefined\s*$/.test(parts[pos])) parts[pos] = " " + meter;
    else { console.log(`  НЕ ТРОНУТ ${file}: на месте meter не undefined: ${parts[pos].trim().slice(0, 40)}`); skipped++; continue; }
    const trailingNl = /\n\s*$/.test(argsText) ? argsText.match(/\n\s*$/)[0] : "";
    const neu = parts.map((a, i) => (i === 0 ? a : a.startsWith(" ") || a.startsWith("\n") ? a : " " + a)).join(",") + trailingNl;
    if (APPLY) src = src.slice(0, s.start) + neu + src.slice(s.end);
    changed++;
    console.log(`  ${APPLY ? "правка" : "план"} ${file}: ${s.fn} → ${meter}`);
  }
  if (APPLY) fs.writeFileSync(p, src);
}
console.log(`${APPLY ? "изменено" : "к изменению"} вызовов: ${changed}, пропущено: ${skipped}`);
