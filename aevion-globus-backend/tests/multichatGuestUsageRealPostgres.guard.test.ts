/**
 * Счёт гостя Мультичата в базе — SQL исполняет НАСТОЯЩИЙ Postgres (PGlite в памяти), не подделка.
 *
 * ЗАЧЕМ (30.10.2026). Сторож `multichatGuestUsageSurvivesRestart` подменяет пул регулярками:
 * он доказывает, что модуль ХОДИТ в базу и переживает перезапуск, но пропустил бы любую
 * опечатку в самом SQL — на проде такой запрос упал бы, модуль молча откатился бы в память
 * (одна строка «СЧЁТ ГОСТЯ НЕ В БАЗЕ» в журнале), и норма гостя снова обнулялась бы каждой
 * выкаткой. Таблица создаётся на лету первым обращением, миграции нет — значит, проверить
 * CREATE TABLE IF NOT EXISTS, INSERT … ON CONFLICT … RETURNING и SELECT … = ANY($2::text[])
 * можно только исполнением. Образец — tests/registeredCounterIsHonest.guard.test.ts.
 *
 * Подменён только getPool(): его query() отдаёт запрос PGlite как есть, с теми же $-параметрами
 * (строки и массив строк), что и в pg.
 */
import { describe, test, expect, vi, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";

/** База живёт ВНЕ модуля — переживает vi.resetModules(), как настоящий Postgres переживает выкатку. */
const база = vi.hoisted(() => ({ db: null as any, запросов: 0 }));

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    async query(text: string, params?: unknown[]) {
      база.запросов += 1;
      return база.db.query(text, params);
    },
  }),
}));

const prevKey = process.env.AEVION_EDGE_KEY;
let error: ReturnType<typeof vi.spyOn>;
// Запуск WASM-движка — десятки секунд на занятой машине (замер 30.10: 40 с); он один на файл,
// отдельные случаи укладываются в обычный лимит.
beforeAll(async () => {
  база.db = new PGlite();
  await база.db.waitReady;
}, 120_000);
beforeEach(async () => {
  vi.resetModules();
  await база.db.exec('DROP TABLE IF EXISTS "MultichatGuestUsage"');
  база.запросов = 0;
  delete process.env.AEVION_EDGE_KEY;
  vi.spyOn(console, "warn").mockImplementation(() => {});
  error = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  if (prevKey === undefined) delete process.env.AEVION_EDGE_KEY; else process.env.AEVION_EDGE_KEY = prevKey;
});
afterAll(async () => {
  await база.db?.close();
});

function запрос(адрес: string, устройство: string) {
  const headers: Record<string, string> = { "x-aevion-device": устройство };
  return { headers, get(h: string) { return headers[h.toLowerCase()]; }, socket: { remoteAddress: адрес }, ip: адрес, body: {} } as any;
}
const поднять = () => import("../src/lib/multichatGuestPass");
const строкиТаблицы = async () =>
  (await база.db.query('SELECT "key", "day", "count" FROM "MultichatGuestUsage" ORDER BY "key"')).rows as Array<{ key: string; day: string; count: unknown }>;

describe("счёт гостя в настоящем Postgres (PGlite)", () => {
  test("две траты → в таблице строки ip: и dev: со count=2 (число), остаток 0; после перезапуска — тоже 0", async () => {
    const m = await поднять();
    const { denPoMestnomu } = await import("../src/lib/denPoMestnomu");
    const r = запрос("10.1.1.1", "dev-pg");
    await m.засчитатьГостю(r);
    await m.засчитатьГостю(r);

    const строки = await строкиТаблицы();
    expect(строки.map((s) => s.key)).toEqual([`dev:dev-pg:${denPoMestnomu()}`, `ip:10.1.1.1:${denPoMestnomu()}`]);
    for (const s of строки) {
      expect(s.day).toBe(denPoMestnomu());
      expect(s.count, "INTEGER должен прийти числом, не строкой").toBe(2);
    }
    expect((await m.остатокГостя(r)).осталось).toBe(0);

    // Перезапуск: память модуля (в т.ч. флаг «таблица готова») пропадает, CREATE TABLE IF NOT EXISTS идёт повторно на существующую таблицу.
    vi.resetModules();
    const m2 = await поднять();
    const после = await m2.остатокГостя(запрос("10.1.1.1", "dev-pg"));
    expect(после).toMatchObject({ осталось: 0, использовано: 2 });
    expect(error, "настоящая база отвечала — отката в память быть не должно").not.toHaveBeenCalled();
  });

  test("SELECT … = ANY($2::text[]): чужое устройство того же адреса не видит чужих трат, вчерашние строки не считаются", async () => {
    const m = await поднять();
    const { vcheraPoMestnomu } = await import("../src/lib/denPoMestnomu");
    await m.засчитатьГостю(запрос("10.2.2.2", "dev-A"));
    await m.засчитатьГостю(запрос("10.2.2.2", "dev-A"));
    // Вчерашняя трата того же устройства — другой день, в норму сегодня не входит.
    await база.db.query(
      'INSERT INTO "MultichatGuestUsage" ("key","day","count") VALUES ($1,$2,2)',
      [`dev:dev-B:${vcheraPoMestnomu()}`, vcheraPoMestnomu()],
    );

    expect((await m.остатокГостя(запрос("10.2.2.2", "dev-A"))).осталось).toBe(0);
    const чужое = await m.остатокГостя(запрос("10.2.2.2", "dev-B"));
    expect(чужое.осталось, "своя норма устройства; адрес потратил 2 из потолка 10").toBe(2);
    expect(чужое.использовано).toBe(0);
  });

  test("потолок адреса в базе: 10 трат с одного адреса разными устройствами → новому устройству 0", async () => {
    const m = await поднять();
    for (let i = 0; i < 10; i += 1) await m.засчитатьГостю(запрос("10.3.3.3", `dev-${i}`));
    const строки = await строкиТаблицы();
    expect(строки.find((s) => s.key.startsWith("ip:10.3.3.3:"))?.count, "ON CONFLICT DO UPDATE накапливает, а не перезаписывает").toBe(10);
    expect((await m.остатокГостя(запрос("10.3.3.3", "dev-new"))).осталось).toBe(0);
    expect(error).not.toHaveBeenCalled();
  });

  test("без устройства — ключ только по адресу, одна строка в таблице", async () => {
    const m = await поднять();
    const r = { headers: {}, get() { return undefined; }, socket: { remoteAddress: "10.4.4.4" }, ip: "10.4.4.4", body: {} } as any;
    await m.засчитатьГостю(r);
    const строки = await строкиТаблицы();
    expect(строки).toHaveLength(1);
    expect(строки[0].key).toMatch(/^ip:10\.4\.4\.4:\d{4}-\d{2}-\d{2}$/);
    expect(строки[0].count).toBe(1);
  });
});
