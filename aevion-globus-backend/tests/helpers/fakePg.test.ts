import { describe, test, expect } from "vitest";
import { makeFakePool, rows, written } from "./fakePg";

// Проверка самой подделки. Инструмент, которому доверяют десятки тестов, обязан
// быть проверен отдельно — иначе его ошибка станет ошибкой всех сразу.

describe("общая поддельная база отвечает как настоящая", () => {
  test("rowCount есть ВСЕГДА, даже когда строк нет", async () => {
    const Pool = makeFakePool();
    const p = new Pool();
    const r = await p.query("INSERT INTO x VALUES (1)", []);

    // Именно отсутствие rowCount трижды за два дня скрывало дефекты.
    expect(r).toHaveProperty("rowCount");
    expect(typeof r.rowCount).toBe("number");
  });

  test("rowCount совпадает с числом строк", async () => {
    expect(rows([{ a: 1 }, { a: 2 }]).rowCount).toBe(2);
    expect(rows([]).rowCount).toBe(0);
    expect(written(3).rowCount).toBe(3);
  });

  test("failOn бросает — путь отказа можно проверить", async () => {
    const Pool = makeFakePool({ failOn: /INSERT/i });
    const p = new Pool();

    await expect(p.query("INSERT INTO x VALUES (1)", [])).rejects.toThrow();
    await expect(p.query("SELECT 1", [])).resolves.toBeDefined();
  });

  test("задержка настоящая — мгновенный ответ прячет гонки", async () => {
    // Тест, зелёный только потому, что подделка отвечает мгновенно, проверяет
    // скорость, а не поведение. Это уже случалось.
    const Pool = makeFakePool({ delayMs: 40 });
    const p = new Pool();
    const t0 = Date.now();
    await p.query("SELECT 1", []);

    expect(Date.now() - t0).toBeGreaterThanOrEqual(30);
  });

  test("журнал запросов записывает и текст, и параметры", async () => {
    const log: Array<{ text: string; params: unknown[] }> = [];
    const Pool = makeFakePool({ log });
    const p = new Pool();
    await p.query("SELECT $1", ["привет"]);

    expect(log).toHaveLength(1);
    expect(log[0].params).toEqual(["привет"]);
  });

  test("обработчики применяются по порядку, первый подошедший выигрывает", async () => {
    const Pool = makeFakePool({
      handlers: [
        (t) => (/SELECT "id"/.test(t) ? rows([{ id: "первый" }]) : undefined),
        (t) => (/SELECT/.test(t) ? rows([{ id: "второй" }]) : undefined),
      ],
    });
    const p = new Pool();

    expect((await p.query('SELECT "id" FROM t', [])).rows[0]).toEqual({ id: "первый" });
    expect((await p.query("SELECT other FROM t", [])).rows[0]).toEqual({ id: "второй" });
  });
});
