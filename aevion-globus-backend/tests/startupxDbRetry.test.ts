import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  ensureStartupExchangeTables,
  isStartupExchangeDbReady,
  getStartupExchangeDbError,
  __resetStartupExchangeDbState,
} from "../src/lib/ensureStartupExchangeTables";

/**
 * Замер 27.07.2026 на живом Postgres 18: первое подключение при старте процесса
 * отвалилось по таймауту, функция залатчилась — и модуль остался в памяти при
 * полностью рабочей базе. В проде это заявки, которые исчезают на рестарте, а
 * видно это только в /health. Тест сторожит ровно это: неудача не приговор.
 */
function fakePool(behaviour: () => void) {
  return {
    query: async () => {
      behaviour();
      return { rows: [] };
    },
  } as never;
}

describe("готовность базы StartupX", () => {
  beforeEach(() => {
    __resetStartupExchangeDbState();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it("после неудачи пробует снова и поднимается", async () => {
    let down = true;
    const pool = fakePool(() => {
      if (down) throw new Error("Connection terminated due to connection timeout");
    });

    await ensureStartupExchangeTables(pool);
    expect(isStartupExchangeDbReady()).toBe(false);
    expect(getStartupExchangeDbError()).toContain("timeout");

    down = false;
    // Пауза между попытками: сразу после неудачи повтора нет, иначе каждый
    // запрос в минуту недоступности добавлял бы свой таймаут ко времени ответа.
    await ensureStartupExchangeTables(pool);
    expect(isStartupExchangeDbReady()).toBe(false);

    vi.advanceTimersByTime(10_001);
    await ensureStartupExchangeTables(pool);
    expect(isStartupExchangeDbReady()).toBe(true);
    expect(getStartupExchangeDbError()).toBeNull();
  });

  it("успех латчится: база больше не опрашивается", async () => {
    let calls = 0;
    const pool = fakePool(() => { calls += 1; });
    await ensureStartupExchangeTables(pool);
    expect(isStartupExchangeDbReady()).toBe(true);
    const afterFirst = calls;

    vi.advanceTimersByTime(60_000);
    await ensureStartupExchangeTables(pool);
    expect(calls).toBe(afterFirst);
  });

  it("падение создания таблиц — тоже не приговор", async () => {
    let failCreate = true;
    const pool = {
      query: async (sql: string) => {
        if (sql.includes("SELECT 1")) return { rows: [] };
        if (failCreate) throw new Error("permission denied for schema public");
        return { rows: [] };
      },
    } as never;

    await ensureStartupExchangeTables(pool);
    expect(isStartupExchangeDbReady()).toBe(false);
    expect(getStartupExchangeDbError()).toContain("permission denied");

    failCreate = false;
    vi.advanceTimersByTime(10_001);
    await ensureStartupExchangeTables(pool);
    expect(isStartupExchangeDbReady()).toBe(true);
  });
});
