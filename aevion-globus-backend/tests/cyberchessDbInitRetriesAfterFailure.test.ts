import { describe, test, expect, vi, beforeEach } from "vitest";

// Первая неудача подключения не должна выключать базу навсегда. 19.08.2026.
//
// ensureDb() ставил dbInitTried = true ПЕРЕД попыткой и больше не пробовал
// никогда. Значит один обрыв сети в момент первого обращения — и модуль до
// перезапуска процесса работает только в памяти: партии, рейтинги и начисления
// Chessy никуда не пишутся, а снаружи это выглядит как обычная работа.
//
// Это тот же класс, что «кулдаун вместо защёлки»: защёлка превращает временную
// неисправность в постоянную, и чинится она только случайным рестартом.

const { db } = vi.hoisted(() => {
  process.env.DATABASE_URL = "postgres://test/test";
  process.env.CYBERCHESS_DB_INIT_RETRY_MS = "50"; // в тесте ждать минуту незачем
  return { db: { failInit: true, initCalls: 0 } };
});

vi.mock("pg", () => {
  class Pool {
    async query(text: string) {
      if (/CREATE TABLE/i.test(text)) {
        db.initCalls += 1;
        if (db.failInit) throw new Error("connection terminated unexpectedly");
        return { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 0 };
    }
    on() {}
    async end() {}
  }
  return { default: { Pool }, Pool };
});

import { ensureDb, matchStoreHealth } from "../src/routes/cyberchessMatchStore";

beforeEach(() => {
  db.initCalls = 0;
});

/** Ждём условие, а не «спим наугад». */
async function until(cond: () => boolean, ms = 3000): Promise<boolean> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (cond()) return true;
    await new Promise((r) => setTimeout(r, 20));
  }
  return false;
}

describe("подключение к базе пробуется снова после сбоя", () => {
  test("первая попытка падает и это видно", async () => {
    await ensureDb();
    expect(db.initCalls).toBeGreaterThan(0);
    expect(matchStoreHealth.lastErrorKind).not.toBeNull();
  });

  test("после паузы попытка повторяется, а не блокируется навсегда", async () => {
    const after = db.initCalls;
    await new Promise((r) => setTimeout(r, 80)); // дольше окна повтора
    await ensureDb();

    // Главное: попытка ВТОРАЯ. До починки счётчик стоял бы на месте, потому что
    // ensureDb выходил по защёлке первой строкой.
    expect(db.initCalls).toBeGreaterThan(after);
  });

  test("когда база поднялась, подключение устанавливается", async () => {
    db.failInit = false;
    await new Promise((r) => setTimeout(r, 80));
    await ensureDb();

    const ok = await until(() => matchStoreHealth.connected === true);
    expect(ok).toBe(true);
  });
});
