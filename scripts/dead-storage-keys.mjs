#!/usr/bin/env node
// Ключи localStorage/sessionStorage, которые ЧИТАЮТ, но не пишет НИКТО.
//   node scripts/dead-storage-keys.mjs
//
// Отчёт, а не гейт — намеренно. Гейт на этот класс есть только для ключей
// входа (scripts/auth-token-key-ratchet.test.mjs), потому что там имена
// известны и список закрыт. Здесь список открыт, и часть находок требует
// человеческого решения: ключ может быть мёртв законно (миграция старых
// сессий) или писаться из кода, которого ещё нет.
//
// Зачем инструмент существует. Дефект «читают ключ, которого никто не пишет»
// не даёт отказа: страница просто ведёт себя так, будто настройки или сессии
// не существует. Найти его чтением кода почти невозможно — литерал выглядит
// осмысленно. Найти сплошным сопоставлением чтений и записей — минута.
//
// Чем это уже закончилось (12.08.2026):
//   • семейство ключей входа: 78 файлов, целиком QPayNet и 25 страниц QCoreAI
//     не видели вошедшего человека. Причём ВТОРОЕ семейство (aevion_auth_token,
//     aevion:auth:token, build_token, build_auth_token) нашлось только этим
//     сопоставлением — точечный греп по известным именам его не видел;
//   • QBuild: собственная сессия не заполнялась ни из одного файла;
//   • 3D-глобус читал "aevion:locale", а язык хранится в "aevion_lang_v1".

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const SRC = path.join(HERE, "..", "frontend", "src");

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    if (e === "node_modules" || e === ".next") continue;
    const f = path.join(dir, e);
    if (statSync(f).isDirectory()) walk(f, out);
    else if (/\.(ts|tsx)$/.test(e)) out.push(f);
  }
  return out;
}

const RE_READ = /(?:localStorage|sessionStorage)\.getItem\(\s*["'`]([^"'`]+)["'`]\s*\)/g;
const RE_WRITE = /(?:localStorage|sessionStorage)\.setItem\(\s*["'`]([^"'`]+)["'`]/g;
// Ключ часто вынесен в константу: const LS_TAB = "aevion:healthai:tab".
// Без этого прохода все такие ключи выглядели бы мёртвыми.
const RE_CONST = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::\s*string\s*)?=\s*["'`]([^"'`]+)["'`]/g;
const RE_WRITE_VAR = /(?:localStorage|sessionStorage)\.setItem\(\s*([A-Za-z_$][\w$]*)\s*[,)]/g;
const RE_READ_VAR = /(?:localStorage|sessionStorage)\.getItem\(\s*([A-Za-z_$][\w$]*)\s*\)/g;

const files = walk(SRC);
const readers = new Map();
const writers = new Map();
const constNames = new Map();

const add = (map, key, file) => {
  if (!map.has(key)) map.set(key, new Set());
  map.get(key).add(path.relative(SRC, file).split(path.sep).join("/"));
};

for (const file of files) {
  const t = readFileSync(file, "utf8");
  const local = new Map();
  for (const m of t.matchAll(RE_CONST)) local.set(m[1], m[2]);
  for (const [n, v] of local) constNames.set(n, v);
  for (const m of t.matchAll(RE_READ)) add(readers, m[1], file);
  for (const m of t.matchAll(RE_WRITE)) add(writers, m[1], file);
  for (const m of t.matchAll(RE_WRITE_VAR)) if (local.get(m[1])) add(writers, local.get(m[1]), file);
  for (const m of t.matchAll(RE_READ_VAR)) if (local.get(m[1])) add(readers, local.get(m[1]), file);
}
// Второй проход: константа объявлена в другом файле и импортирована.
for (const file of files) {
  const t = readFileSync(file, "utf8");
  for (const m of t.matchAll(RE_WRITE_VAR)) if (constNames.get(m[1])) add(writers, constNames.get(m[1]), file);
}

// Ключи с ${} — шаблонные (`qai_msgs_${id}`). Чтение и запись идут одним
// шаблоном, но имя переменной внутри разное, поэтому текстово они не
// совпадают и попадали в «мёртвые» ложно. Такие показываем отдельно.
const isTemplate = (k) => k.includes("${");
const dead = [];
const templates = [];
for (const [key, where] of readers) {
  if (writers.has(key)) continue;
  (isTemplate(key) ? templates : dead).push({ key, where: [...where] });
}
dead.sort((a, b) => b.where.length - a.where.length);

console.log(`ключей читается: ${readers.size}, пишется: ${writers.size}`);
console.log(`\nЧИТАЮТ, НО НЕ ПИШЕТ НИКТО: ${dead.length}`);
for (const d of dead) {
  console.log(`  ${d.key}  — ${d.where.length} файл(ов): ${d.where.slice(0, 4).join(", ")}${d.where.length > 4 ? ` … +${d.where.length - 4}` : ""}`);
}
if (templates.length) {
  console.log(`\nшаблонные ключи (проверять глазами, обычно ложные): ${templates.map((t) => t.key).join(", ")}`);
}
