import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";

/**
 * Сбой чтения расхода не должен читаться как «расход ноль».
 *
 * Найдено 28.07 при переносе приёма «мутация вместо чтения» с публичных ручек на
 * ДЕНЕЖНЫЕ пути — там цена ошибки выше. В `src/routes/devhub.ts`:
 *
 *     async function getMonthUsage(...) {
 *       try { ... } catch { return 0; }        // ← «не смогли прочитать» = «не тратил»
 *     }
 *
 *     async function checkCredit(...) {
 *       const used = await getMonthUsage(...);
 *       return { allowed: used + amount <= limit, ... };
 *     }
 *
 * То есть сбой запроса к таблице расхода превращается в «использовано ноль», а
 * `checkCredit` тогда считает `0 + amount <= limit` и РАЗРЕШАЕТ операцию. Пока
 * запрос падает, платная квота фактически не ограничивает никого: каждый вызов
 * видит чистый счёт. Ни падения, ни записи в лог — самый дорогой вид дефекта.
 *
 * ЧТО ИСПРАВЛЕНО: `getMonthUsage` возвращает `null`, когда прочитать не удалось,
 * причина уходит в лог сервера, а `/studio/credits` отдаёт `usageKnown: false`.
 * Теперь «использовано 0» при недоступном счётчике ОТЛИЧИМО от честного нуля.
 *
 * ЧТО НЕ МЕНЯЛОСЬ: политика. При недоступном счётчике по-прежнему пускаем —
 * иначе сбой базы отключил бы платным клиентам оплаченные возможности. Но это
 * стало явным выбором в одной строке с именем, а не побочным эффектом
 * `catch { return 0 }`. Смена политики на «не пускать» — продуктовое решение,
 * вынесено основателю.
 *
 * Второй дефект, закреплённый здесь же: `debitCredit` при сбое ЗАПИСИ откатывается
 * в память (`memUsage`), а `getMonthUsage` при живой БД в память не смотрит
 * вообще. Списания, ушедшие в резервное хранилище, для последующих проверок
 * невидимы — два хранилища и один путь чтения.
 */

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: mockQuery }),
}));

// eslint-disable-next-line import/first
import { devhubRouter } from "../src/routes/devhub";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/devhub", devhubRouter);
  return app;
}

/** Таблицы «есть», расход по всем возможностям — 40. */
function healthyPool() {
  mockQuery.mockImplementation(async (sql: unknown) => {
    const q = String(sql);
    if (/FROM\s+"DevHubUsage"/i.test(q)) return { rows: [{ used: 40 }], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  });
}

/** Тот же расход есть в базе, но КАЖДОЕ чтение расхода падает. */
function brokenUsageReads() {
  mockQuery.mockImplementation(async (sql: unknown) => {
    const q = String(sql);
    if (/SELECT\s+"used"\s+FROM\s+"DevHubUsage"/i.test(q)) {
      throw new Error("could not connect to server: Connection refused");
    }
    return { rows: [], rowCount: 0 };
  });
}

beforeEach(() => {
  mockQuery.mockReset();
});

describe("расход кредитов при недоступном счётчике", () => {
  it("при живой базе расход виден — иначе проверки ниже были бы про пустоту", async () => {
    healthyPool();
    const res = await request(makeApp()).get("/api/devhub/studio/credits");
    expect(res.status).toBe(200);
    const used = Object.values(res.body.usage as Record<string, { used: number }>).map((u) => u.used);
    expect(used.length).toBeGreaterThan(3);
    expect(used.every((n) => n === 40), "расход из базы не доехал до ответа").toBe(true);
  });

  it("сбой чтения ОТЛИЧИМ от честного нуля — usageKnown: false", async () => {
    brokenUsageReads();
    const res = await request(makeApp()).get("/api/devhub/studio/credits");
    expect(res.status).toBe(200);
    // Числа по-прежнему нулевые (политику не меняли), но ответ ГОВОРИТ, что им
    // нельзя верить. До правки этого признака не было вовсе, и «использовано 0»
    // при недоступном счётчике выглядело как честный ноль.
    expect(res.body.usageKnown, "ответ не сообщает, что счётчик недоступен").toBe(false);
  });

  it("честный ноль помечен как ИЗВЕСТНЫЙ — иначе признак ничего не различал бы", async () => {
    // Дискриминирующая сила: если usageKnown всегда false, предыдущая проверка
    // проходила бы при любом поведении.
    mockQuery.mockImplementation(async () => ({ rows: [], rowCount: 0 }));
    const res = await request(makeApp()).get("/api/devhub/studio/credits");
    expect(res.status).toBe(200);
    expect(res.body.usageKnown).toBe(true);
    const used = Object.values(res.body.usage as Record<string, { used: number }>).map((u) => u.used);
    expect(used.every((n) => n === 0)).toBe(true);
  });

  it("🔴 ЗАФИКСИРОВАНО: списание, ушедшее в резервное хранилище, для чтения невидимо", async () => {
    // Запись расхода падает → debitCredit откатывается в память.
    // Чтение при живой БД в память не смотрит → расход показывается нулевым.
    mockQuery.mockImplementation(async (sql: unknown) => {
      const q = String(sql);
      if (/INSERT\s+INTO\s+"DevHubUsage"/i.test(q)) throw new Error("write failed");
      if (/SELECT\s+"used"\s+FROM\s+"DevHubUsage"/i.test(q)) return { rows: [], rowCount: 0 };
      return { rows: [], rowCount: 0 };
    });
    const res = await request(makeApp()).get("/api/devhub/studio/credits");
    expect(res.status).toBe(200);
    const used = Object.values(res.body.usage as Record<string, { used: number }>).map((u) => u.used);
    expect(used.every((n) => n === 0), "резервное хранилище неожиданно попало в чтение").toBe(true);
  });
});
