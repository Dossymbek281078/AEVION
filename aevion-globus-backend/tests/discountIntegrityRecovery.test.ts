import { describe, test, expect, vi, beforeEach } from "vitest";

/**
 * Метрика «скидок пообещали и не применили» не должна выключаться навсегда из-за
 * ОДНОГО сбоя базы.
 *
 * Раньше в `discountIntegrityLog` стоял одноразовый флаг `ensured`: первая
 * неудачная попытка — и запись выключена до редеплоя, молча. Первая попытка
 * падает не в теории: 2026-07-26 в живом прогоне первый запрос к Postgres после
 * старта процесса не проходил (холодный пул). То есть один блип на старте — и
 * расхождений «обещали/списали» мы не видим весь срок жизни процесса.
 *
 * Тест держит поведение: после сбоя — фолбэк на память и честный
 * `source: "memory"`, но при восстановлении базы метрика возвращается сама.
 */

const db = { fail: true, calls: 0, failInsertsOnly: false };

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: async (sql: string) => {
      db.calls += 1;
      const isInsert = /INSERT INTO/i.test(sql ?? "");
      if (db.fail || (db.failInsertsOnly && isInsert)) {
        throw new Error(isInsert ? "relation does not exist (имитация)" : "connection refused (имитация)");
      }
      return { rows: [], rowCount: 0 };
    },
  }),
}));

const { integritySummary, recordCheckoutSession } = await import("../src/lib/discountIntegrityLog");

beforeEach(() => {
  db.calls = 0;
});

describe("метрика восстанавливается после сбоя базы", () => {
  test("база недоступна → source memory, и это сказано честно", async () => {
    db.fail = true;
    const s = await integritySummary(30);
    expect(s.source).toBe("memory");
    expect(s.bootedAt).toBeTruthy(); // клиент видит, что числа «с момента старта»
  });

  test("🔴 повторный вызов сразу после сбоя базу НЕ дёргает (не молотим по мёртвой)", async () => {
    db.fail = true;
    await integritySummary(30);
    const callsAfterFirst = db.calls;
    await integritySummary(30);
    expect(db.calls).toBe(callsAfterFirst);
  });

  test("🔴 упавшая ВСТАВКА не молчит: база помечается недоступной, метрика чинится сама", async () => {
    // Ловушка того же класса: ensureTable однажды прошёл, dbUsable = true, а
    // каждая вставка тихо падает вечно — «ведём» метрику, не записав ни строки.
    const warns: string[] = [];
    const realWarn = console.warn;
    console.warn = (...a: unknown[]) => void warns.push(a.join(" "));
    const realNow = Date.now;
    try {
      db.fail = false;
      db.failInsertsOnly = false;
      Date.now = () => realNow() + 200_000; // сбрасываем кулдаун
      expect((await integritySummary(30)).source).toBe("db"); // база «жива»

      db.failInsertsOnly = true;
      recordCheckoutSession({
        provider: "gumroad", tier: "medium", incentiveUsd: 21.8, quotedUsd: 45.2, honoured: false,
      });
      await new Promise((r) => setTimeout(r, 30));

      expect(warns.some((w) => w.includes("[discountIntegrity]"))).toBe(true); // не молча
      // И база помечена недоступной → следующий ensureTable пере-создаст таблицу.
      Date.now = realNow;
      expect((await integritySummary(30)).source).toBe("memory");
    } finally {
      console.warn = realWarn;
      Date.now = realNow;
      db.failInsertsOnly = false;
    }
  });

  test("🔴 база вернулась → метрика возвращается сама, без редеплоя", async () => {
    // Проматываем кулдаун: одноразовый флаг здесь бы навсегда оставил
    // source "memory", и никто бы не заметил.
    //
    // Смещение больше, чем у предыдущего теста (200 с): состояние модуля общее
    // на файл, и «минуты вперёд» не хватило бы — кулдаун был бы ещё в будущем.
    // Ровно та ловушка, из-за которой этот тест сначала покраснел.
    db.fail = false;
    const realNow = Date.now;
    try {
      Date.now = () => realNow() + 400_000;
      const s = await integritySummary(30);
      expect(s.source).toBe("db");
      expect(s.bootedAt).toBeUndefined(); // из базы — не «с момента старта»
    } finally {
      Date.now = realNow;
    }
  });
});
