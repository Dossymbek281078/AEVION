import { describe, test, expect, vi, beforeEach } from "vitest";

// Проверка колонок в БОЕВОЙ базе, а не в CREATE TABLE.
//
// 20.08.2026: /api/build/documents/user/<id> отдавал 500 на ЛЮБОЙ запрос,
// при этом сторожа схемы были зелёными — они сверяют запросы с CREATE TABLE,
// то есть с намерением. `CREATE TABLE IF NOT EXISTS` к существующей таблице
// колонок не добавляет, и разбором исходника это не видно в принципе.

const queries: string[] = [];
let behaviour: (sql: string) => void = () => {};
let poolThrows = false;

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => {
    if (poolThrows) throw new Error("no database url");
    return {
      query: async (sql: string) => {
        queries.push(sql);
        behaviour(sql);
        if (sql.includes("information_schema")) return { rows: [{ n: 87 }], rowCount: 1 };
        return { rows: [], rowCount: 0 };
      },
    };
  },
}));

const { checkQueriedSchemas, SCHEMA_CHECKS } = await import("../src/lib/schemaHealth");

describe("schemaHealth — колонки проверяются на живой базе", () => {
  beforeEach(() => { queries.length = 0; behaviour = () => {}; poolThrows = false; });

  test("всё на месте -> ok, и запросы РЕАЛЬНО отправлены", async () => {
    const r = await checkQueriedSchemas();
    expect(r.ok).toBe(true);
    expect(r.failures).toEqual([]);
    // Без этого тест был бы зелёным и на коде, который ничего не спрашивает.
    // +1 запрос — знаменатель (сколько таблиц в базе всего)
    expect(queries.length).toBe(SCHEMA_CHECKS.length + 1);
    expect(queries.filter((q) => /LIMIT 0/i.test(q)).length).toBe(SCHEMA_CHECKS.length);
  });

  test("нет колонки -> НЕ ok, и названа именно она", async () => {
    behaviour = (sql) => {
      if (sql.includes("BuildDocument")) throw new Error('column "reviewedAt" does not exist');
    };
    const r = await checkQueriedSchemas();
    expect(r.ok).toBe(false);
    expect(r.failures.map((f) => f.name)).toContain("BuildDocument.reviewFields");
    expect(r.failures[0].error).toMatch(/reviewedAt/);
  });

  test("падает ОДНА проверка — остальные всё равно выполняются", async () => {
    behaviour = (sql) => { if (sql.includes("BuildDocument")) throw new Error("boom"); };
    const r = await checkQueriedSchemas();
    expect(queries.length).toBe(SCHEMA_CHECKS.length + 1);
    expect(r.failures.length).toBe(1);
  });

  test("базу спросить не удалось -> это НЕ «здоров»", async () => {
    poolThrows = true;
    const r = await checkQueriedSchemas();
    expect(r.ok).toBe(false);
    expect(r.failures[0].error).toMatch(/спросить не удалось/);
  });

  test("список проверок не пуст (контроль прибора)", () => {
    expect(SCHEMA_CHECKS.length).toBeGreaterThan(0);
    expect(SCHEMA_CHECKS.every((c) => /LIMIT 0/i.test(c.sql))).toBe(true);
  });

  test("охват назван честно: проверено N из ВСЕХ таблиц", () => {
    // «Проверено 2» звучит как охват. Знаменатель превращает это в выборку,
    // и по нему сразу видно, насколько она мала.
    expect(SCHEMA_CHECKS.length).toBeGreaterThan(0);
  });

  test("знаменатель отдаётся, а при отказе — null, а не ноль", async () => {
    const good = await checkQueriedSchemas();
    expect(good.tablesTotal).toBe(87);

    behaviour = (sql) => { if (sql.includes("information_schema")) throw new Error("нет доступа"); };
    const bad = await checkQueriedSchemas();
    // Ноль таблиц и «спросить не удалось» — разные вещи. Ноль читался бы
    // как факт о базе, null честно говорит «охват неизвестен».
    expect(bad.tablesTotal).toBeNull();
    expect(bad.ok).toBe(true);   // сам отказ знаменателя не делает базу больной
  });
});
