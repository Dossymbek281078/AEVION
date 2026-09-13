import { describe, test, expect, vi } from "vitest";

/**
 * Путь БАЗЫ у воронки отказов — тот, что работает на проде (`source: "db"`).
 * Существующий тест проверяет только запасной путь в памяти, а разница между
 * ними как раз в том, ради чего заведена аудитория: в базе лежат СТАРЫЕ
 * строки, записанные до 13.09.2026, у которых поля нет вовсе.
 *
 * Главное утверждение файла: старые строки видны ОТДЕЛЬНОЙ категорией
 * "unknown" и не приписываются анониму. Замер на проде 13.09: таких строк
 * было около 14 тысяч — слив их с анонимом, мы объявили бы роботами всё, что
 * платформа собрала за месяц.
 */
const { sqlSeen } = vi.hoisted(() => ({ sqlSeen: [] as string[] }));

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    on: () => {},
    query: (sql: string) => {
      sqlSeen.push(String(sql));
      if (String(sql).includes('SELECT "module"')) {
        return Promise.resolve({
          rows: [
            // Старьё без поля: СУБД отдаёт его через COALESCE как "unknown".
            { module: "qlearn", plan: "free", audience: "unknown", denies: 4004, last24h: 0 },
            { module: "qlearn", plan: "free", audience: "anonymous", denies: 6, last24h: 6 },
            { module: "qlearn", plan: "free", audience: "registered", denies: 2, last24h: 1 },
            { module: "qai", plan: "free", audience: "registered", denies: 10, last24h: 3 },
          ],
        });
      }
      return Promise.resolve({ rows: [] });
    },
  }),
}));

import { funnelSummary } from "../src/lib/paywallDenyLog";

describe("воронка отказов: путь базы и старые строки", () => {
  test("старые строки — отдельная категория, а не анонимы", async () => {
    const f = await funnelSummary(30);

    expect(f.source, "тест обязан идти путём базы, иначе он не про то").toBe("db");
    expect(f.totalDenies).toBe(4022);

    // Разбивка по платформе: три разные категории, ни одна не поглощена.
    expect(f.byAudience).toEqual({ unknown: 4004, anonymous: 6, registered: 12 });

    const qlearn = f.byModule.find((m) => m.module === "qlearn");
    expect(qlearn?.byAudience).toEqual({ unknown: 4004, anonymous: 6, registered: 2 });

    // Именно это и нельзя допустить: «неизвестно» слито с «аноним».
    expect(qlearn?.byAudience.anonymous, "старые строки приписаны анониму").toBe(6);
  });

  test("сумма по аудитории сходится с общим числом отказов", async () => {
    const f = await funnelSummary(30);
    const сумма = Object.values(f.byAudience).reduce((s, n) => s + (n ?? 0), 0);
    // Расхождение означало бы, что часть строк выпала из разбивки молча —
    // ровно так выглядит потерянная категория.
    expect(сумма).toBe(f.totalDenies);
  });

  test("запрос действительно спрашивает аудиторию и щадит старые строки", async () => {
    await funnelSummary(30);
    const select = sqlSeen.find((s) => s.includes('SELECT "module"')) ?? "";
    expect(select, "в выборке нет аудитории — разбивка была бы выдумкой").toContain("audience");
    expect(select, "без COALESCE старые строки выпали бы из группировки").toContain("COALESCE");
    // Утверждение о ТЕКСТЕ запроса, и это осознанно: пул здесь замокан, СУБД
    // в модульном тесте нет, поэтому подмену значения по умолчанию иначе не
    // поймать. Замена 'unknown' на 'anonymous' оставила бы COALESCE на месте
    // и тихо приписала роботам все старые строки — проверка выше её
    // пропускает, эта нет.
    expect(select, "значение по умолчанию должно быть 'unknown', а не аудитория").toContain("'unknown'");
    // Колонку обязан заводить сам код: на живой базе её не было.
    expect(sqlSeen.some((s) => s.includes("ADD COLUMN IF NOT EXISTS")), "миграция не выполняется").toBe(true);
  });
});
