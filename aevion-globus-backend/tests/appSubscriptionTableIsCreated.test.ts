// Таблица `AppSubscription` создаётся кодом, как и остальные 282.
//
// Найдено зондом по проду 19.08.2026:
//   GET /api/apps/access                       -> 400 "email required"  (верно)
//   GET /api/apps/access?email=любой@адрес.com -> 500 "db error"        (ВСЕГДА)
//
// Таблица была объявлена только в prisma/schema.prisma и не создавалась никем.
// В этом репозитории схему ведут кодом: 282 CREATE TABLE IF NOT EXISTS против
// нуля применённых миграций Prisma. Из 26 моделей схемы «только в схеме» шесть,
// но используется РОВНО ОДНА — эта; остальные пять не читает ни один роутер.
//
// Цена: в таблицу пишут оба обработчика покупок, читает её проверка прав.
// Цепочка «заплатил -> запись -> доступ открыт» шла через таблицу, которой нет.

import { describe, test, expect, beforeEach } from "vitest";
import {
  ensureAppSubscriptionTable,
  resetAppSubscriptionEnsured,
} from "../src/lib/ensureAppSubscriptionTable";

function fakePool(fail = false) {
  const sql: string[] = [];
  return {
    sql,
    query: async (q: string) => {
      sql.push(q);
      if (fail) throw new Error("storage unreachable");
      return { rows: [], rowCount: 0 };
    },
  };
}

beforeEach(() => resetAppSubscriptionEnsured());

describe("создание таблицы AppSubscription", () => {
  test("создаёт таблицу", async () => {
    const p = fakePool();
    await ensureAppSubscriptionTable(p as never);
    expect(p.sql.join("\n")).toMatch(/CREATE TABLE IF NOT EXISTS "AppSubscription"/);
  });

  test("создаёт уникальность (email, appSlug) — без неё падает ЗАПИСЬ покупки", async () => {
    // Обработчики покупок делают ON CONFLICT ("email","appSlug"). Postgres
    // требует под это уникальный индекс: починив чтение и забыв индекс, мы
    // сломали бы запись — то есть сам денежный путь.
    const p = fakePool();
    await ensureAppSubscriptionTable(p as never);
    expect(p.sql.join("\n")).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS[\s\S]*?"email",\s*"appSlug"/);
  });

  test("второй вызов в базу не ходит", async () => {
    const p = fakePool();
    await ensureAppSubscriptionTable(p as never);
    const after = p.sql.length;
    await ensureAppSubscriptionTable(p as never);
    expect(p.sql.length).toBe(after);
  });

  test("сбой НЕ засчитывается за успех — следующий вызов пробует снова", async () => {
    // Иначе разовый обрыв связи навсегда объявил бы таблицу созданной, и
    // все последующие запросы уходили бы в пустоту. Это тот же класс, что
    // «упавшее чтение становится фактом».
    const bad = fakePool(true);
    await expect(ensureAppSubscriptionTable(bad as never)).rejects.toThrow();
    const good = fakePool();
    await ensureAppSubscriptionTable(good as never);
    expect(good.sql.length).toBeGreaterThan(0);
  });
});

describe("ручка доступа и запись покупки зовут создание", () => {
  test("appAccess зовёт ensure до запроса", async () => {
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("../src/routes/appAccess.ts", import.meta.url), "utf8"),
    );
    const calls = [...src.matchAll(/ensureAppSubscriptionTable\(pool\)/g)];
    const selects = [...src.matchAll(/FROM "AppSubscription"/g)];
    expect(calls.length).toBe(selects.length); // каждому запросу — своё создание
  });

  test("запись покупки тоже зовёт ensure", async () => {
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("../src/lib/appEntitlements.ts", import.meta.url), "utf8"),
    );
    expect(src).toMatch(/ensureAppSubscriptionTable\(pool\)[\s\S]{0,400}?INSERT INTO "AppSubscription"/);
  });
});
