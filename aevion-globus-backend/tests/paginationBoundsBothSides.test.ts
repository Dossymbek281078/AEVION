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
  // Файл, где limit пришёл ДЕСТРУКТУРИЗАЦИЕЙ, проверяем целиком: в самой строке
  // `req.query` тогда нет. Три места (qjobs, qevents, qnews) прятались именно
  // так и нашлись только по живым 500 с прода — через сутки после того, как я
  // объявил класс закрытым.
  const destructured = /const\s*\{[^}]*\blimit\b[^}]*\}\s*=\s*req\.query/.test(src);
  return src.split("\n").filter((l) => {
    // Комментарии — не код. Проверка краснела на объяснении, написанном рядом с
    // починкой: в нём стояли и `req.query.limit`, и `Math.min`. Сканер, читающий
    // примеры в комментариях, — отдельный класс ложных срабатываний.
    const t = l.trim();
    if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) return false;
    if (!/\blimit\b/i.test(l)) return false;
    if (!/req\.query/.test(l) && !destructured) return false;
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
    //
    // Утверждение намеренно НЕ привязано к тексту выражения. Первая версия
    // требовала дословно мой идиом Math.min(Math.max(Number(...)...), и когда
    // соседняя сессия закрыла ту же дыру ЛУЧШЕ — через parseInt(String(...)),
    // который переживает и ?limit=zzz, — тест покраснел на правильном коде.
    // Тест обязан охранять свойство, а не мою формулировку.
    const line = src.split(String.fromCharCode(10)).find((l) => /const limit *=/.test(l)) ?? "";
    expect(line, "строка с limit не найдена").not.toBe("");
    expect(line, "нет нижней границы: ?limit=-1 уйдёт в SQL").toMatch(/Math\.max\(/);
    expect(line, "нет верхней границы: ?limit=99999 выгребет таблицу").toMatch(/Math\.min\(/);
    expect(
      /parseInt\(String\(|Number\.isFinite|queryNumber\(/.test(line),
      "нет защиты от нечисла: ?limit=zzz даст NaN и 500",
    ).toBe(true);
  });
});
