// Сканер: вызовы callProvider / callProviderResilient в src/, у которых НЕТ учёта (аргумент meter).
// 23.10.2026: сводка «[qcoreai] платные вызовы БЕЗ учёта за процесс: unknown=659» — расход денег вслепую.
// meter — 7-й аргумент callProvider (после images, maxTokens); для callProviderResilient — см. сигнатуру (ищем тот же объект).
// Учтённым считается вызов, в чьих аргументах есть `module:` (литерал CallMeter) или идентификатор meter/метр.
// Запуск: node scripts/scan-unmetered-calls.mjs [--json]  → печатает список и число; код 0 если 0, иначе 1.
import fs from "node:fs";
import path from "node:path";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "src");
export function findCalls(source, file) {
  const out = [];
  const re = /\b(callProvider|callProviderResilient)\s*\(/g;
  let m;
  while ((m = re.exec(source))) {
    // пропускаем объявления функций и экспорт
    const before = source.slice(Math.max(0, m.index - 30), m.index);
    if (/function\s+$|export\s+async\s+function\s+$|\.\s*$/.test(before)) continue;
    let i = m.index + m[0].length, depth = 1;
    while (i < source.length && depth > 0) { const c = source[i]; if (c === "(") depth++; else if (c === ")") depth--; i++; }
    const args = source.slice(m.index + m[0].length, i - 1);
    if (!args.trim()) continue; // «callProvider()» в комментарии — упоминание, не вызов
    const line = source.slice(0, m.index).split("\n").length;
    const metered = /\bmodule\s*:/.test(args) || /\b(meter|метр|учёт)\w*\b/.test(args);
    const module = (args.match(/\bmodule\s*:\s*"([^"]+)"/) || [])[1] ?? null;
    out.push({ file, line, fn: m[1], metered, module, args: args.replace(/\s+/g, " ").slice(0, 120) });
  }
  return out;
}
export function scanDir(root) {
  const res = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (e.name !== "__tests__") walk(p); } else if (/\.ts$/.test(e.name) && !/\.test\.ts$/.test(e.name) && !/providers\.ts$/.test(e.name)) res.push(...findCalls(fs.readFileSync(p, "utf8"), path.relative(root, p).replace(/\\/g, "/"))); } };
  walk(root);
  return res;
}
if (process.argv[1] && /scan-unmetered-calls\.mjs$/.test(process.argv[1].replace(/\\/g, "/"))) {
  const all = scanDir(ROOT);
  const bad = all.filter((c) => !c.metered);
  if (process.argv.includes("--json")) console.log(JSON.stringify({ total: all.length, unmetered: bad }, null, 1));
  else { console.log(`вызовов всего ${all.length}, без учёта ${bad.length}`); for (const c of bad) console.log(`  ${c.file}:${c.line} ${c.fn}(${c.args})`); }
  process.exit(bad.length ? 1 : 0);
}
