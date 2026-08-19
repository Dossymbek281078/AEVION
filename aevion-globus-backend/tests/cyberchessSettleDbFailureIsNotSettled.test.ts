import { describe, test, expect, vi, beforeEach } from "vitest";

// Отказ базы при захвате партии — это НЕ «партию уже закрыли». 18.08.2026.
//
// Захват конца партии делается атомарным UPDATE ... WHERE status <> 'ended'
// RETURNING id. Пустой ответ означает «закрыл кто-то другой» — начислять
// нельзя. Но помощник q() отдавал пустой список И ПРИ ОТКАЗЕ базы, поэтому
// сбой сети читался как штатный повтор: Chessy не начислялись, игроку
// отвечали ok, и в системе не оставалось ни счётчика, ни строки об этом.
//
// Первая версия этого теста звала несуществующую recordMatchEnded и имела
// запасную ветку «функция не экспортирована — тогда проверка текстовая».
// Она и сработала: тест был зелёным, не проверив НИЧЕГО. Функция называется
// finalizeMatch. Запасных веток здесь больше нет.

const { db } = vi.hoisted(() => {
  // Без адреса базы модуль считает её ненастроенной и выходит ДО захвата —
  // первая версия теста не выполнила ни одного запроса и была зелёной наполовину.
  process.env.DATABASE_URL = "postgres://test/test";
  return { db: { failClaim: false, alreadyEnded: false, queries: [] as string[] } };
});

vi.mock("pg", () => {
  class Pool {
    async query(text: string, _params: unknown[] = []) {
      db.queries.push(text);
      if (/UPDATE "CyberMatch" SET "status"='ended'/i.test(text)) {
        if (db.failClaim) throw new Error("connection terminated unexpectedly");
        // Пусто = строку закрыл кто-то другой; одна строка = захват наш.
        return db.alreadyEnded ? { rows: [], rowCount: 0 } : { rows: [{ id: "m1" }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }
    on() {}
  }
  return { default: { Pool }, Pool };
});

import { finalizeMatch, matchStoreHealth } from "../src/routes/cyberchessMatchStore";

const INFO = {
  whiteUserId: "u1",
  blackUserId: "u2",
  timeControl: "180+0",
  result: "white" as const,
  termination: "normal",
};

beforeEach(() => {
  db.queries.length = 0;
  db.failClaim = false;
  db.alreadyEnded = false;
  matchStoreHealth.claimUnknown = 0;
  matchStoreHealth.writeErrors = 0;
});

describe("отказ базы на захвате отличается от «уже закрыта»", () => {
  test("база не ответила → счётчик claimUnknown вырос", async () => {
    db.failClaim = true;
    const res = await finalizeMatch("m1", INFO);

    expect(res).toBeNull(); // начислять нельзя — мы не знаем, наш ли захват
    expect(matchStoreHealth.claimUnknown).toBe(1);
  });

  test("партию закрыл другой → счётчик НЕ растёт", async () => {
    // Обратная сторона: если бы счётчик рос и здесь, он перестал бы отличать
    // сбой от нормы — а это ровно тот дефект, который чинится.
    db.alreadyEnded = true;
    const res = await finalizeMatch("m1", INFO);

    expect(res).toBeNull();
    expect(matchStoreHealth.claimUnknown).toBe(0);
  });
});
