import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Шаг CI, ссылающийся на несуществующий скрипт, падает — это заметно. Опаснее
// другое: шаг, который удалили или переименовали, а проверку считают идущей.
// 28.07.2026 так молчали три смока слоя доверия (`npmScriptRunners.test.ts`),
// 10.08.2026 — весь фронтовый юнит-набор (`testsActuallyRun.test.ts`).
//
// Здесь третий срез того же: всё, что workflow'ы зовут по имени файла или по
// имени npm-скрипта, должно существовать.
//
// Намеренно БЕЗ разбора YAML: парсера в зависимостях бэкенда нет, а тянуть его
// из frontend/node_modules нельзя — CI-job бэкенда ставит только свои пакеты.
// Поэтому проверяем не структуру workflow, а ссылки в его тексте.
//
// Что этот тест НЕ ловит (честная граница): шаг, объявленный с неверным
// `working-directory` — файл существует, но не там, откуда его зовут. Такое
// ловится только запуском. Ловится здесь: удалённый файл, переименованный
// файл, опечатка в имени npm-скрипта.

const BACKEND = path.join(__dirname, "..");
const ROOT = path.join(BACKEND, "..");
const WF_DIR = path.join(ROOT, ".github", "workflows");

/** Каталоги, из которых workflow'ы реально запускают шаги. */
const RUN_DIRS = [".", "aevion-globus-backend", "frontend"];

function workflowFiles(): string[] {
  return fs
    .readdirSync(WF_DIR)
    .filter((f) => /\.ya?ml$/.test(f))
    .map((f) => path.join(WF_DIR, f));
}

function allScriptNames(): Set<string> {
  const out = new Set<string>();
  for (const dir of RUN_DIRS) {
    const p = path.join(ROOT, dir, "package.json");
    if (!fs.existsSync(p)) continue;
    const scripts = JSON.parse(fs.readFileSync(p, "utf8")).scripts || {};
    for (const name of Object.keys(scripts)) out.add(name);
  }
  return out;
}

describe("шаги CI ссылаются на то, что существует", () => {
  it("в .github/workflows есть хотя бы один workflow", () => {
    // Иначе тест ниже пройдёт вхолостую и будет выглядеть проверкой.
    expect(workflowFiles().length).toBeGreaterThan(0);
  });

  it("каждый `node scripts/<файл>` из workflow существует", () => {
    const missing: string[] = [];
    for (const file of workflowFiles()) {
      const src = fs.readFileSync(file, "utf8");
      for (const m of src.matchAll(/\bnode\s+(scripts\/[\w./-]+\.(?:m?js|cjs))/g)) {
        const rel = m[1];
        const found = RUN_DIRS.some((d) => fs.existsSync(path.join(ROOT, d, rel)));
        if (!found) missing.push(`${path.basename(file)}: node ${rel}`);
      }
    }
    expect(missing, `шаги зовут несуществующие скрипты:\n${missing.join("\n")}`).toEqual([]);
  });

  it("каждый `npm run <скрипт>` из workflow объявлен в каком-то package.json", () => {
    const known = allScriptNames();
    const missing: string[] = [];
    for (const file of workflowFiles()) {
      const src = fs.readFileSync(file, "utf8");
      for (const m of src.matchAll(/\bnpm run ([a-zA-Z][\w:.-]*)/g)) {
        if (!known.has(m[1])) missing.push(`${path.basename(file)}: npm run ${m[1]}`);
      }
    }
    expect(missing, `шаги зовут необъявленные npm-скрипты:\n${missing.join("\n")}`).toEqual([]);
  });

  it("npm-скрипты пакетов не зовут несуществующие файлы", () => {
    const missing: string[] = [];
    for (const dir of RUN_DIRS) {
      const p = path.join(ROOT, dir, "package.json");
      if (!fs.existsSync(p)) continue;
      const scripts: Record<string, string> = JSON.parse(fs.readFileSync(p, "utf8")).scripts || {};
      for (const [name, cmd] of Object.entries(scripts)) {
        for (const m of cmd.matchAll(/(?:node|ts-node(?:\s+-T)?|tsx)\s+([\w./-]+\.(?:m?js|cjs|ts))/g)) {
          // Артефакты сборки пропускаем: "start" зовёт dist/index.js, которого в
          // чистой копии нет и быть не должно — он появляется после npm run build.
          // Без этого тест краснел не на дефекте, а на том, что рядом не собирали,
          // и краснота приучала считать его шумом (19.08.2026).
          if (/^(dist|build|out|\.next)\//.test(m[1])) continue;
          if (!fs.existsSync(path.join(ROOT, dir, m[1]))) {
            missing.push(`${dir}/package.json → "${name}" зовёт ${m[1]}`);
          }
        }
      }
    }
    expect(missing, `скрипты зовут несуществующие файлы:\n${missing.join("\n")}`).toEqual([]);
  });
});
