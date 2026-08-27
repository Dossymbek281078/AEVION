import { describe, expect, test } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

// Ежедневный сторож прода не работал НИКОГДА — замер 19.08.2026.
//
// Задача «Prod read-only smoke sweep» шла только по расписанию, ставила
// зависимости с --ignore-scripts и НЕ собирала бэкенд. Два смока из 45
// (qcore-fleet, qcore-autoroute) читают скомпилированные модули из dist/, поэтому
// падали мгновенно с «Cannot find module», оркестратор выходил с 1, и весь обход
// был красным — при 43 прошедших проверках из 45.
//
// Итог: 32 из 32 запусков по расписанию — провал, ни одного успешного за всю
// историю. На push тот же набор проходит 46 раз из 68, потому что push-задача
// собирает. То есть красный цвет означал отсутствие сборки, а не состояние прода,
// и к нему привыкли.
//
// Этот сторож проверяет КЛАСС, а не один файл: любая задача CI, запускающая обход
// смоков, обязана собирать бэкенд.

const WORKFLOWS = join(__dirname, "..", "..", ".github", "workflows");

/**
 * Разбивает workflow на блоки задач.
 *
 * Разбор начинается ПОСЛЕ строки `jobs:` — первая версия считала задачей любой
 * ключ на двух пробелах отступа и объявила виновным `push`, то есть ключ внутри
 * `on:`. Прибор соврал раньше, чем нашёл дефект.
 */
function jobs(text: string): { name: string; body: string }[] {
  const all = text.split(/\r?\n/);
  const start = all.findIndex((l) => /^jobs:\s*$/.test(l));
  if (start < 0) return [];
  const lines = all.slice(start + 1);
  const out: { name: string; body: string }[] = [];
  let cur: { name: string; body: string } | null = null;
  for (const line of lines) {
    const m = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line);
    if (m) {
      if (cur) out.push(cur);
      cur = { name: m[1], body: "" };
    } else if (cur) {
      cur.body += line + "\n";
    }
  }
  if (cur) out.push(cur);
  return out;
}

describe("задача, запускающая обход смоков, обязана собирать бэкенд", () => {
  const files = existsSync(WORKFLOWS)
    ? readdirSync(WORKFLOWS).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
    : [];

  test("прибор нашёл workflow и умеет делить их на задачи", () => {
    // Отрицательный контроль. Без него «ни одной задачи без сборки» могло бы
    // означать «не прочитал ни одного файла» — самый удобный способ быть зелёным.
    expect(files.length).toBeGreaterThan(0);
    const daily = files.find((f) => f.includes("daily-smoke"));
    expect(daily, "daily-smoke.yml не найден").toBeTruthy();
    const parsed = jobs(readFileSync(join(WORKFLOWS, daily!), "utf8"));
    expect(parsed.length).toBeGreaterThan(3);
    expect(parsed.some((j) => j.body.includes("all-smokes.js"))).toBe(true);
  });

  test("ни одна задача не запускает all-smokes.js без сборки", () => {
    const guilty: string[] = [];
    for (const f of files) {
      for (const j of jobs(readFileSync(join(WORKFLOWS, f), "utf8"))) {
        if (!j.body.includes("all-smokes.js")) continue;
        // Сборкой считаем и `npm run build`, и прямой вызов tsc.
        const builds = /npm run build|npx tsc|\btsc\b/.test(j.body);
        if (!builds) guilty.push(`${f} → ${j.name}`);
      }
    }
    expect(guilty, "эти задачи запустят обход без dist/ и упадут мгновенно").toEqual([]);
  });

  test("смоки, читающие dist/, действительно существуют — иначе сторож охраняет пустоту", () => {
    // Если эти два скрипта перестанут читать dist/, правило выше станет
    // бессмысленным, и об этом надо узнать здесь, а не в красном CI.
    const scripts = join(__dirname, "..", "scripts");
    const readsDist = readdirSync(scripts)
      .filter((f) => f.endsWith(".js"))
      .filter((f) => /require\(.{0,40}\.\.\/dist\//.test(readFileSync(join(scripts, f), "utf8")));
    expect(readsDist.length).toBeGreaterThan(0);
  });
});
