import { describe, test, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Границы постраничного вывода должны быть с ОБЕИХ сторон.
 *
 * Замер 19.08.2026, живой 500 на проде:
 *
 *   GET /api/qpersona/personas?limit=-1  ->  500
 *   Sentry: "error: LIMIT must not be negative"
 *
 * Причина видна была в двух соседних строках:
 *   limit  = Math.min(Number(...) || 20, 100)   ← только верхняя граница
 *   offset = Math.max(Number(...) || 0,  0)     ← только нижняя
 *
 * Каждому досталась ровно та половина, которой не хватало другому. И `|| 20` не
 * спасает: -1 — истинное значение, подстановка по умолчанию не срабатывает.
 *
 * Почему это важнее одной ручки: неверные данные в запросе — это 4xx, ответ о
 * запросе. 5xx означает «у нас сломалось», попадает в Sentry, поднимает людей и
 * топит настоящие аварии в шуме. Один робот с ?limit=-1 давал поток тревог.
 */

const ROOT = join(__dirname, "..", "src", "routes");

/** Строки, где limit из запроса зажимается только сверху. */
function halfBounded(src: string): string[] {
  return src.split("\n").filter((l) => {
    if (!/\blimit\b/i.test(l)) return false;
    if (!/req\.query/.test(l)) return false;
    const hasUpper = /Math\.min/.test(l);
    const hasLower = /Math\.max/.test(l);
    return hasUpper && !hasLower;
  }).map((l) => l.trim());
}

describe("постраничный вывод зажат с обеих сторон", () => {
  test("контроль: проверка умеет отличать зажатое от незажатого", () => {
    // Иначе она проходила бы на чём угодно, включая пустой файл.
    expect(halfBounded('const limit = Math.min(Number(req.query.limit) || 20, 100);')).toHaveLength(1);
    expect(halfBounded('const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);')).toHaveLength(0);
    expect(halfBounded('const offset = Math.max(Number(req.query.offset) || 0, 0);')).toHaveLength(0);
  });

  test("НИ ОДИН маршрут не зажимает limit только сверху", () => {
    // Не одна ручка, а класс. Замер 19.08.2026: шесть мест в пяти файлах, из
    // них три давали живой 500 на проде (qpersona, deepsan, qlife). Остальные
    // молчали лишь потому, что путь запроса другой — дефект тот же.
    const files = readdirSync(ROOT).filter((f) => f.endsWith(".ts"));
    const bad: string[] = [];
    for (const f of files) {
      for (const line of halfBounded(readFileSync(join(ROOT, f), "utf8"))) {
        bad.push(`${f}: ${line}`);
      }
    }
    expect(
      bad,
      "limit зажат только сверху — отрицательное значение уйдёт в Postgres и вернёт 500 вместо 400",
    ).toEqual([]);
    // Контроль охвата: файлов должно быть много, иначе проверка вхолостую.
    expect(files.length, "каталог маршрутов не прочитан").toBeGreaterThan(30);
  });

  test("qpersona: limit зажат снизу и сверху", () => {
    const src = readFileSync(join(ROOT, "qpersona.ts"), "utf8");
    expect(
      halfBounded(src),
      "limit снова зажат только сверху — ?limit=-1 уйдёт в Postgres и вернёт 500 вместо 400",
    ).toEqual([]);
    // И прямая проверка, что нижняя граница именно там, где нужна.
    expect(src).toMatch(/Math\.min\(Math\.max\(Number\(req\.query\.limit\)/);
  });
});
