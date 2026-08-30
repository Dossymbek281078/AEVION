/**
 * Пересобирает README-INDEX.md — список скриптов этой папки с пояснением.
 *
 * ЗАЧЕМ. Указатель без генератора протухает в первую же неделю, и тогда он
 * ХУЖЕ отсутствия: человек ищет в нём, не находит свежий скрипт и пишет свой.
 *
 * Описание берётся из первого содержательного комментария файла. Нет
 * комментария — скрипт попадёт в список с прочерком; это не ошибка, а повод
 * дописать первую строку в сам скрипт.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "README-INDEX.md");
const MARKER = "| скрипт | что делает |";

function describe(file) {
  let head;
  try {
    head = readFileSync(join(HERE, file), "utf8").slice(0, 1200);
  } catch {
    return "";
  }
  const block = head.match(/\/\*\*([\s\S]*?)\*\//);
  if (block) {
    for (const raw of block[1].split("\n")) {
      const line = raw.trim().replace(/^\*+/, "").trim();
      if (line.length > 12 && !line.startsWith("@")) return line.slice(0, 110);
    }
  }
  for (const raw of head.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("//") && line.length > 15) {
      return line.replace(/^\/+/, "").trim().slice(0, 110);
    }
  }
  return "";
}

const files = readdirSync(HERE)
  .filter((f) => /\.(js|mjs|ts)$/.test(f))
  .sort();

const rows = files.map((f) => `| \`${f}\` | ${describe(f) || "—"} |`);

// Шапка сохраняется: в ней объяснение, зачем файл нужен, и оно дороже списка.
let existing = "";
try {
  existing = readFileSync(OUT, "utf8");
} catch {}
const cut = existing.indexOf(MARKER);
if (cut < 0) {
  console.log("НЕ ПЕРЕСОБИРАЮ: в README-INDEX.md не найдена шапка со списком.");
  console.log("Ожидалась строка: " + MARKER);
  process.exitCode = 2;
} else {
  const header = existing.slice(0, cut + MARKER.length) + "\n|---|---|\n";
  writeFileSync(OUT, header + rows.join("\n") + "\n");
  const described = rows.filter((r) => !r.endsWith("— |")).length;
  console.log(`README-INDEX.md пересобран: ${files.length} скриптов, с описанием ${described}.`);
}
