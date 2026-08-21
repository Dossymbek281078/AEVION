import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// Скрипт шлёт один параметр, ручка читает другой — и никто не падает.
//
// Замер на проде 21.08.2026: в QStore 20 записей при шести уникальных
// названиях, копий до четырёх. Причина найдена точно:
//
//   скрипт:  /api/qstore/products?search=<название>&limit=1
//   ручка:   const q = req.query.q ...
//
// Чужой параметр игнорируется, поэтому возвращались ВСЕ товары, а limit=1
// оставлял один произвольный. Проверка «уже есть» спрашивала «совпадает ли
// название первого попавшегося с моим», почти всегда получала «нет» и
// создавала копию — по одной за запуск.
//
// В шапке скрипта при этом написано «idempotent via title dedup checks»:
// обещание было, механизма не было. Ни один тест этого не видел, потому что
// обе стороны по отдельности исправны — ломается СТЫК.
//
// Проверено живой пробой: q=QCoreAI -> 4 товара, q=<мусор> -> 0,
// search=<мусор> -> все 20.

const ROOT = path.join(__dirname, "..");
const SEED = readFileSync(path.join(ROOT, "scripts", "seed-demo-content.js"), "utf8");
const ROUTE = readFileSync(path.join(ROOT, "src", "routes", "qstore.ts"), "utf8");

/** Имена параметров запроса, которые ручка списка РЕАЛЬНО читает. */
function paramsRouteReads(): Set<string> {
  const out = new Set<string>();
  for (const m of ROUTE.matchAll(/req\.query\.(\w+)/g)) out.add(m[1]);
  return out;
}

/** Имена параметров, которые скрипт шлёт в /api/qstore/products. */
function paramsSeedSends(): string[] {
  const out: string[] = [];
  for (const m of SEED.matchAll(/\/api\/qstore\/products\?([^`"']+)/g)) {
    for (const pair of m[1].split("&")) {
      const name = pair.split("=")[0].trim();
      if (name) out.push(name);
    }
  }
  return out;
}

describe("заполнение шлёт те параметры, которые ручка читает", () => {
  test("контроль прибора: обе стороны прочитаны и непусты", () => {
    // Пустые множества дали бы зелёный ответ «по нулю параметров».
    expect(SEED.length).toBeGreaterThan(500);
    expect(paramsRouteReads().size).toBeGreaterThan(2);
    expect(paramsSeedSends().length).toBeGreaterThan(0);
  });

  test("каждый посылаемый параметр ручка действительно читает", () => {
    const reads = paramsRouteReads();
    const unknown = paramsSeedSends().filter((p) => !reads.has(p));
    // `search` попал бы сюда — ручка читает `q`.
    expect(unknown).toEqual([]);
  });

  test("проверка «уже есть» не обрезает выборку до одной записи", () => {
    // limit=1 превращает проверку существования в лотерею: она смотрит на
    // один произвольный товар. Обрезка здесь — не оптимизация, а дефект.
    const dedupQueries = [...SEED.matchAll(/\/api\/qstore\/products\?([^`"']+)/g)].map((m) => m[1]);
    expect(dedupQueries.length).toBeGreaterThan(0);
    for (const qs of dedupQueries) {
      const limit = /limit=(\d+)/.exec(qs)?.[1];
      expect(Number(limit ?? 0)).toBeGreaterThan(1);
    }
  });

  test("скрипт не обещает идемпотентности впустую", () => {
    // Обещание в шапке допустимо только вместе с работающей проверкой:
    // фильтр по названию через параметр, который ручка читает.
    if (/idempotent/i.test(SEED)) {
      expect(SEED).toMatch(/products\?q=/);
    }
  });
});
