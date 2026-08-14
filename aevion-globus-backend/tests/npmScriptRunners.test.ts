import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Проверка, которую нельзя запустить, молчит — и молчание читается как здоровье.
//
// 28.07.2026 три смока слоя доверия FAA были объявлены через `tsx`, которого нет
// ни в node_modules, ни в package.json: `npm run` падал на «tsx не является
// внутренней или внешней командой», то есть до первой строки скрипта. Так они и
// не выполнялись НИ РАЗУ с момента появления. Запущенный наконец смок свежести
// сразу дал 5 красных из 12 — он проверял контракт, которого больше нет.
//
// Ни один тест и ни один линтер этого не видел: код скриптов корректен, сломано
// объявление. Отсюда этот тест — он смотрит не в код, а в то, чем код зовут.

const ROOT = path.join(__dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));

/** Команды оболочки и раннеры, которых не бывает в node_modules/.bin. */
const SHELL_BUILTINS = new Set([
  "node", "npm", "npx", "git", "echo", "cd", "rm", "mkdir", "cp", "mv", "set",
  "if", "for", "true", "false", "exit", "bash", "sh", "cmd", "powershell",
]);

/**
 * Первое слово команды — то, что оболочка попытается найти в PATH.
 *
 * Учитываем две формы, которые первым словом НЕ являются:
 *  - префикс переменной окружения: `READ_ONLY=1 node scripts/x.js`;
 *  - путь: `./scripts/x.sh`, `dist/index.js` — такое ищется на диске, а не в .bin.
 */
function runnersOf(command: string): string[] {
  const out: string[] = [];
  for (const part of command.split(/\s*(?:&&|\|\||;|\|)\s*/)) {
    for (const word of part.trim().split(/\s+/)) {
      if (!word) break;
      if (/^[A-Z_][A-Z0-9_]*=/i.test(word)) continue; // префикс окружения
      if (/[/\\]/.test(word)) break; // путь, не раннер
      out.push(word);
      break;
    }
  }
  return out;
}

function installedBins(): Set<string> {
  const dir = path.join(ROOT, "node_modules", ".bin");
  if (!fs.existsSync(dir)) return new Set();
  return new Set(fs.readdirSync(dir).map((f) => f.replace(/\.(cmd|ps1|CMD|PS1)$/, "")));
}

describe("каждый npm-скрипт можно на самом деле запустить", () => {
  const bins = installedBins();

  it("node_modules/.bin вообще прочитан — иначе тест проверял бы пустоту", () => {
    // Без этого тест зелёный на пустом множестве: любой раннер «отсутствует»
    // одинаково и с непоставленными зависимостями, и с реальной опечаткой.
    expect(bins.size).toBeGreaterThan(10);
    expect(bins.has("vitest")).toBe(true);
  });

  const scripts: [string, string][] = Object.entries(pkg.scripts ?? {});

  it("скриптов в package.json достаточно, чтобы проверка что-то значила", () => {
    expect(scripts.length).toBeGreaterThan(10);
  });

  it.each(scripts)("«%s» ссылается на существующий раннер", (name, command) => {
    const missing = runnersOf(String(command)).filter(
      (r) => !SHELL_BUILTINS.has(r) && !bins.has(r) && !(pkg.scripts ?? {})[r],
    );
    expect(
      missing,
      `скрипт «${name}» зовёт ${missing.join(", ")}, которого нет ни в node_modules/.bin, `
        + `ни среди npm-скриптов. Команда упадёт до первой строки, и проверка будет молча не выполняться.`,
    ).toEqual([]);
  });
});
