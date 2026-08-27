// Переменные окружения, которые КОД ЧИТАЕТ, но нигде не заведены.
// Тот же класс, что мёртвый ключ входа: отказа нет, поведение молча другое.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Корень — от самого скрипта, а не строкой. 27.08.2026 здесь стоял
// "C:/Users/user/aevion-money" — чужой worktree, и проверка из любого каталога
// отвечала про ТОТ репозиторий. Отказа при этом нет, вывод правдоподобен.
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CODE_ROOTS = ["aevion-globus-backend/src", "frontend/src", "scripts"];
const DOC_FILES = [
  ".env.example",
  "aevion-globus-backend/.env.example",
  "frontend/.env.example",
  "docs/PROD_ENV_CHECKLIST.md",
  "docs/PROD_ENV_TEMPLATES.md",
];

function walk(d, out = []) {
  if (!existsSync(d)) return out;
  for (const e of readdirSync(d)) {
    if (e === "node_modules" || e === ".next" || e === "dist") continue;
    const f = path.join(d, e);
    if (statSync(f).isDirectory()) walk(f, out);
    else if (/\.(ts|tsx|mjs|js)$/.test(e)) out.push(f);
  }
  return out;
}

// Читаем: process.env.FOO, process.env["FOO"]
const RE_ENV = /process\.env(?:\.([A-Z][A-Z0-9_]*)|\[\s*["']([A-Z][A-Z0-9_]*)["']\s*\])/g;

const read = new Map(); // VAR -> Set(файл)
for (const root of CODE_ROOTS) {
  for (const f of walk(path.join(ROOT, root))) {
    const t = readFileSync(f, "utf8");
    for (const m of t.matchAll(RE_ENV)) {
      const v = m[1] || m[2];
      if (!read.has(v)) read.set(v, new Set());
      read.get(v).add(path.relative(ROOT, f).split(path.sep).join("/"));
    }
  }
}

// Заведены: любое упоминание имени в .env.example / чек-листах / CI
let docs = "";
for (const d of DOC_FILES) {
  const p = path.join(ROOT, d);
  if (existsSync(p)) docs += "\n" + readFileSync(p, "utf8");
}
const wf = path.join(ROOT, ".github/workflows");
if (existsSync(wf)) for (const f of readdirSync(wf)) docs += "\n" + readFileSync(path.join(wf, f), "utf8");

// Служебные, которые заводит платформа, а не мы.
const PLATFORM = new Set([
  "NODE_ENV", "PORT", "CI", "VERCEL", "VERCEL_ENV", "VERCEL_URL", "npm_package_version",
  "HOME", "PATH", "TMPDIR", "TEMP", "USERPROFILE", "RAILWAY_ENVIRONMENT", "GITHUB_ACTIONS",
  "NEXT_RUNTIME", "TZ", "DEBUG", "NODE_OPTIONS", "npm_lifecycle_event",
]);

const undocumented = [];
for (const [v, where] of read) {
  if (PLATFORM.has(v)) continue;
  if (docs.includes(v)) continue;
  undocumented.push({ v, where: [...where] });
}
undocumented.sort((a, b) => b.where.length - a.where.length);

console.log(`переменных читается: ${read.size}, из них не заведено нигде: ${undocumented.length}\n`);
for (const u of undocumented) {
  console.log(`  ${u.v}  — ${u.where.length}: ${u.where.slice(0, 3).join(", ")}${u.where.length > 3 ? ` …+${u.where.length - 3}` : ""}`);
}
