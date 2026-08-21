import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Ответ из ЗАПАСНОЙ ветки обязан называть хранилище.
 *
 * Общий сторож на пять модулей вместо пяти одинаковых.
 *
 * Признак точный, а не «в файле есть память»: ответ считается запасным, только
 * если запись в память стоит в пределах 15 строк ВЫШЕ него. Грубый вариант
 * («файл имеет и базу, и память») дал 366 находок по всем маршрутам — число
 * подозрительно крупное, и по нашему же правилу это повод усомниться в приборе,
 * а не радоваться. Точный дал 76, в этих пяти модулях — 16, все настоящие.
 *
 * Метод маршрута проверяется отдельно, и это обязательно: `GET /status` и
 * `GET /health` попадали в находки только потому, что рядом выше случилась
 * запись в память. Требовать признак от чтения — ложная тревога, а сторож,
 * краснеющий на здоровом коде, отключают вместе с полезной частью.
 */

const ROOT = join(__dirname, "..", "src", "routes");
const MODULES = ["qgood.ts", "qnews.ts", "mapReality.ts", "voiceOfEarth.ts", "ventures.ts"];

const RESPONSE = /^(return )?res\.(status\(20[01]\)\.)?json\(\{/;
const MEM_WRITE = /\bmem\w*\.(set|push|unshift)\(/;
const ROUTE = /Router\.(get|post|patch|put|delete)\(/;
const NOT_A_WRITE = /error|not_found|unauthor|forbidden|invalid/i;

/** Ответы записи, перед которыми в пределах 15 строк была запись в память. */
function unmarkedFallbacks(src: string): string[] {
  const L = src.split("\n");
  const out: string[] = [];
  for (let i = 0; i < L.length; i++) {
    const t = L[i].trim();
    if (!RESPONSE.test(t)) continue;
    if (/storage:|mode:/.test(t)) continue;
    if (NOT_A_WRITE.test(t)) continue;
    if (!MEM_WRITE.test(L.slice(Math.max(0, i - 15), i).join("\n"))) continue;
    let method: string | null = null;
    for (let j = i; j >= 0 && j > i - 80; j--) {
      const m = ROUTE.exec(L[j]);
      if (m) { method = m[1]; break; }
    }
    if (method && method !== "get") out.push(`${method.toUpperCase()} · ${t.slice(0, 64)}`);
  }
  return out;
}

describe("запасная ветка называет хранилище", () => {
  test("контроль: проверка отличает помеченный ответ от непомеченного", () => {
    const bad = 'qgoodRouter.post("/mood", () => {\nmemMoods.push(entry);\nres.status(201).json({ ok: true, entry });';
    const good = 'qgoodRouter.post("/mood", () => {\nmemMoods.push(entry);\nres.status(201).json({ ok: true, entry, storage: "memory" });';
    expect(unmarkedFallbacks(bad)).toHaveLength(1);
    expect(unmarkedFallbacks(good)).toHaveLength(0);
  });

  test("контроль: чтение признака не требует", () => {
    const read = 'qgoodRouter.get("/status", () => {\nmemMoods.push(x);\nres.json({ module: "qgood" });';
    expect(unmarkedFallbacks(read), "сторож требует признак от GET — это ложная тревога").toHaveLength(0);
  });

  test("контроль: запись в памяти ДАЛЕКО от ответа не считается запасной веткой", () => {
    const far = 'qgoodRouter.post("/x", () => {\nmemMoods.push(entry);' + "\n".repeat(20) + "res.json({ ok: true });";
    expect(unmarkedFallbacks(far)).toHaveLength(0);
  });

  for (const f of MODULES) {
    test(`${f}: ответы запасной ветки помечены`, () => {
      const src = readFileSync(join(ROOT, f), "utf8");
      expect(src.length, `${f} не прочитан`).toBeGreaterThan(500);
      expect(
        unmarkedFallbacks(src),
        `${f}: ответ неотличим от настоящего сохранения — человек не узнает, что запись временная`,
      ).toEqual([]);
    });
  }
});
