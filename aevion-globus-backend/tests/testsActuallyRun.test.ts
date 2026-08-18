import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Написанный тест, который никто не запускает, вреднее отсутствующего: он
// создаёт ощущение покрытия и молчит ровно там, где должен был кричать.
//
// 10.08.2026 в монорепо таких оказалось 476 — весь фронтовый юнит-набор
// (перехватчик 402 в `lib/paywall`, ToastProvider, InstallPrompt,
// PipelineSteps, комиссии QTrade, гвардия чисел питча). Не выполнялся нигде:
//
//   • job `frontend` в CI делал только `next build` — шага с тестами не было;
//   • локальная привычная команда `npx vitest run` ИЗ КОРНЯ репозитория
//     запускала их без `environment: "jsdom"`, без `setupFiles` и без алиаса
//     `@` (в корне нет ни vitest, ни конфига — npx брал свой), и они падали
//     всегда. Заодно она собирала `frontend/e2e/*.spec.ts` — Playwright-спеки,
//     которые под vitest не запускаются в принципе. Корневой прогон стабильно
//     показывал ~32 падения при двух реальных, и его вывод перестали читать.
//
// Этот тест смотрит не в код тестов, а в то, вызывают ли их вообще: в CI и в
// корневых npm-скриптах. Тот же класс проверки, что `npmScriptRunners.test.ts`
// (объявление сломано, код цел) и `qskywaySmokesWired.test.ts`.

const BACKEND = path.join(__dirname, "..");
const ROOT = path.join(BACKEND, "..");

const rootPkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const frontPkg = JSON.parse(fs.readFileSync(path.join(ROOT, "frontend", "package.json"), "utf8"));
const backPkg = JSON.parse(fs.readFileSync(path.join(BACKEND, "package.json"), "utf8"));
const ci = fs.readFileSync(path.join(ROOT, ".github", "workflows", "ci.yml"), "utf8");

/**
 * Тело job'а из workflow: строки от `  <name>:` до следующего ключа той же
 * вложенности. Полноценный YAML-парсер ради одного файла не тянем — структура
 * `ci.yml` плоская и стабильная.
 */
function jobBlock(name: string): string {
  const lines = ci.split(/\r?\n/);
  const start = lines.findIndex((l) => l === `  ${name}:`);
  expect(start, `job "${name}" не найден в ci.yml`).toBeGreaterThanOrEqual(0);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^ {2}[A-Za-z][\w-]*:\s*$/.test(l));
  return (end === -1 ? rest : rest.slice(0, end)).join("\n");
}

describe("тесты, которые мы написали, кто-то действительно запускает", () => {
  it("фронтовый юнит-набор объявлен в package.json и это vitest", () => {
    expect(frontPkg.scripts?.["test:run"]).toBeDefined();
    expect(frontPkg.scripts["test:run"]).toMatch(/\bvitest\b/);
    // `vitest` без `run` в CI повис бы в watch-режиме до таймаута job'а.
    expect(frontPkg.scripts["test:run"]).toMatch(/\brun\b/);
  });

  it("CI-job frontend запускает фронтовые тесты, а не только сборку", () => {
    const block = jobBlock("frontend");
    // Форм вызова у одного и того же набора две, и обе законные:
    // `npm run test:run` и `npm run test -- --run`. 14.08.2026 сторож требовал
    // ПЕРВУЮ дословно и покраснел, когда ветка подтянула вторую из main, —
    // проверка смысла не нарушена, нарушено совпадение по букве. Требуем то,
    // что действительно важно: вызов есть И он не в watch-режиме (голый
    // `npm run test` повис бы в CI до таймаута job'а).
    expect(block, "фронтовый набор не вызывается в job'е frontend").toMatch(
      /run:\s*npm run (?:test:run|test\s+--\s+--run)(?:\s|$)/m,
    );
    expect(block).toMatch(/run:\s*npm run build/);
  });

  it("CI-job backend запускает бэкендовые тесты", () => {
    expect(jobBlock("backend")).toMatch(/run:\s*npm test/);
    expect(backPkg.scripts?.test).toMatch(/\bvitest\b.*\brun\b/);
  });

  it("корневой `npm test` существует и ведёт к обоим пакетам", () => {
    expect(rootPkg.scripts?.test).toBeDefined();
    const runner = path.join(ROOT, "scripts", "run-all-tests.mjs");
    expect(rootPkg.scripts.test).toContain("scripts/run-all-tests.mjs");
    expect(fs.existsSync(runner)).toBe(true);

    const src = fs.readFileSync(runner, "utf8");
    expect(src).toContain("aevion-globus-backend");
    expect(src).toContain("frontend");
  });

  it("общий прогон не останавливается на первом упавшем пакете", () => {
    // Иначе две известные хроники бэкенда снова закрыли бы фронтенду дорогу —
    // это и есть исходная дыра, а не мелочь стиля.
    // Комментарии отбрасываем: в самом скрипте разобрано, почему `&&` не
    // годится, и эта фраза не должна считаться нарушением.
    const src = fs
      .readFileSync(path.join(ROOT, "scripts", "run-all-tests.mjs"), "utf8")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(src).not.toMatch(/npm run test:backend\s*&&\s*npm run test:frontend/);
    expect(src).toMatch(/for\s*\(/); // оба пакета проходятся циклом, затем общий код возврата
  });

  it("корневой vitest.config.ts отказывает, а не запускает половину набора", () => {
    const cfg = fs.readFileSync(path.join(ROOT, "vitest.config.ts"), "utf8");
    expect(cfg).toMatch(/throw new Error/);
    // Отказ обязан назвать рабочую команду — иначе он просто ещё одна поломка.
    expect(cfg).toContain("npm test");
    // `projects` тут выглядит решением, но роняет все фронтовые воркеры
    // (`Cannot find package 'jsdom'`) и молча отдаёт только бэкенд.
    expect(cfg).not.toMatch(/^\s*projects\s*:/m);
  });
});
