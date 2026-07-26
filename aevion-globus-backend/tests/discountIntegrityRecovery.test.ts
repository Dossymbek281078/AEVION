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

const db = { fail: true, calls: 0 };

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: async () => {
      db.calls += 1;
      if (db.fail) throw new Error("connection refused (имитация)");
      return { rows: [], rowCount: 0 };
    },
  }),
}));

const { integritySummary } = await import("../src/lib/discountIntegrityLog");

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

  test("🔴 база вернулась → метрика возвращается сама, без редеплоя", async () => {
    // Проматываем минуту кулдауна: одноразовый флаг здесь бы навсегда оставил
    // source "memory", и никто бы не заметил.
    db.fail = false;
    const realNow = Date.now;
    try {
      Date.now = () => realNow() + 61_000;
      const s = await integritySummary(30);
      expect(s.source).toBe("db");
      expect(s.bootedAt).toBeUndefined(); // из базы — не «с момента старта»
    } finally {
      Date.now = realNow;
    }
  });
});
