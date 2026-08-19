import { describe, test, expect, vi, beforeEach } from "vitest";

/**
 * Доска концептов обязана говорить, ГДЕ сообщение оказалось.
 *
 * Замер 19.08.2026. Хранилище пишет в Postgres, а при недоступной базе кладёт
 * запись в Map на 200 штук — и возвращает её В ТОМ ЖЕ ВИДЕ, что успешную
 * запись. Человек получал 201 и свою идею; она исчезала при следующем
 * перезапуске. Выкаток в день бывает шесть.
 *
 * О подмене знал только `console.warn`. Это и есть класс «тихая неправильная
 * работа»: ничего не падает, ничего не в Sentry, данных нет.
 *
 * Доской пользуются 18 модулей через одну точку монтажа — значит и признак
 * нужен один, в самих данных.
 */

vi.mock("../src/lib/dbPool", () => ({ getPool: () => mockPool }));

let dbWorks = true;
const mockPool = {
  query: vi.fn(async (sql: string) => {
    if (!dbWorks && /INSERT INTO aevion_concept_messages/i.test(sql)) {
      throw new Error("connection refused");
    }
    if (/^SELECT id, idea/i.test(sql.trim())) return { rows: [], rowCount: 0 };
    return { rows: [{ n: "0" }], rowCount: 1 };
  }),
};

describe("доска концептов называет своё хранилище", () => {
  beforeEach(() => {
    dbWorks = true;
    mockPool.query.mockClear();
    vi.resetModules();
  });

  test("база работает — storage db", async () => {
    const store = await import("../src/lib/conceptBoardStore");
    const m = await store.addMessage("test-mod", { idea: "и", rationale: "р", author: "а" }, ["t"]);
    expect(m.storage, "успешная запись помечена не как db").toBe("db");
  });

  test("база отказала — storage memory, а НЕ db", async () => {
    dbWorks = false;
    const store = await import("../src/lib/conceptBoardStore");
    const m = await store.addMessage("test-mod", { idea: "и", rationale: "р", author: "а" }, ["t"]);
    expect(
      m.storage,
      "запасной путь выдал себя за настоящее сохранение — человек увидит успех, " +
        "а запись исчезнет при перезапуске",
    ).toBe("memory");
  });

  test("контроль: без признака тест не имел бы смысла", async () => {
    // Если поле однажды уберут, обе проверки выше стали бы сравнивать undefined
    // с чем-то и могли бы пройти. Проверяем, что оно объявлено обязательным.
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("../src/lib/conceptBoardStore.ts", import.meta.url), "utf8"),
    );
    expect(src, "поле storage исчезло из ConceptMessage").toMatch(/storage:\s*"db"\s*\|\s*"memory";/);
    expect(src, "признак не уходит наружу — клиент не сможет сказать правду").toMatch(/storage:\s*msg\.storage/);
  });

  test("контроль: заглушка базы умеет и работать, и падать", async () => {
    // Иначе «memory» мог бы получаться всегда, и первый тест был бы ложно зелёным.
    dbWorks = true;
    const ok = await (await import("../src/lib/conceptBoardStore")).addMessage(
      "ctl", { idea: "и", rationale: "р", author: "а" }, ["t"],
    );
    vi.resetModules();
    dbWorks = false;
    const bad = await (await import("../src/lib/conceptBoardStore")).addMessage(
      "ctl", { idea: "и", rationale: "р", author: "а" }, ["t"],
    );
    expect([ok.storage, bad.storage]).toEqual(["db", "memory"]);
  });
});
