/**
 * Норма гостя Мультичата ПЕРЕЖИВАЕТ перезапуск процесса — счёт лежит в базе, не в памяти.
 *
 * ПОВОД (решение Оркестратора 30.10.2026). Счёт жил в `const счёт = new Map` внутри модуля и
 * обнулялся каждой выкаткой — а их 1–3 в день. Гость, исчерпавший 2 бесплатных веера, после
 * очередной сборки получал свежие 2: бесплатный безлимит вместо нормы. Здесь «перезапуск» —
 * это vi.resetModules() и новый import модуля: вся память модуля пропадает, остаётся только
 * то, что он положил в базу. База подменена пулом в памяти ТЕСТА (vi.hoisted), который
 * перезапуск модуля не задевает — как и настоящий Postgres.
 *
 * КОНТРОЛЬ 30.10.2026: на прежнем коде (git show 9a4dba14a:…/multichatGuestPass.ts) все 6 случаев
 * красные; второй — ровно «после перезапуска осталось 2, ожидалось 0» (expected 2 to be +0).
 *
 * Второй блок — ОТКАТ: база падает → считаем в памяти (как раньше), гость получает 200 и свои
 * 2 запроса, а не 0 и не 5xx; в журнале ОДНА строка console.error на процесс, не на запрос.
 */
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";

/** «База»: строки таблицы MultichatGuestUsage по ключу key|day. Живёт ВНЕ модуля — переживает resetModules. */
const база = vi.hoisted(() => ({
  строки: new Map<string, number>(),
  запросов: 0,
  ломать: false,
  бросатьВGetPool: false,
}));

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => {
    if (база.бросатьВGetPool) throw new Error("нет DATABASE_URL (подделка теста)");
    return {
      async query(text: string, params: unknown[] = []) {
        база.запросов += 1;
        if (база.ломать) throw new Error("connection refused (подделка теста)");
        if (/^CREATE TABLE IF NOT EXISTS "MultichatGuestUsage"/.test(text)) return { rows: [] };
        if (/^INSERT INTO "MultichatGuestUsage"/.test(text) && /ON CONFLICT \("key","day"\) DO UPDATE/.test(text) && /RETURNING "count"/.test(text)) {
          const [key, day] = params as [string, string];
          const id = `${key}|${day}`;
          const count = (база.строки.get(id) ?? 0) + 1;
          база.строки.set(id, count);
          return { rows: [{ count }] };
        }
        if (/^SELECT "key", "count" FROM "MultichatGuestUsage" WHERE "day" = \$1 AND "key" = ANY\(\$2::text\[\]\)/.test(text)) {
          const [day, keys] = params as [string, string[]];
          const rows = keys
            .filter((k) => база.строки.has(`${k}|${day}`))
            .map((k) => ({ key: k, count: база.строки.get(`${k}|${day}`) }));
          return { rows };
        }
        throw new Error("подделка базы не понимает запрос: " + text);
      },
    };
  },
}));

const prevKey = process.env.AEVION_EDGE_KEY;
let error: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.resetModules();
  база.строки.clear();
  база.запросов = 0;
  база.ломать = false;
  база.бросатьВGetPool = false;
  delete process.env.AEVION_EDGE_KEY;
  vi.spyOn(console, "warn").mockImplementation(() => {});
  error = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  if (prevKey === undefined) delete process.env.AEVION_EDGE_KEY; else process.env.AEVION_EDGE_KEY = prevKey;
});

function запрос(адрес: string, устройство?: string) {
  const headers: Record<string, string> = {};
  if (устройство) headers["x-aevion-device"] = устройство;
  return { headers, get(h: string) { return headers[h.toLowerCase()]; }, socket: { remoteAddress: адрес }, ip: адрес, body: {} } as any;
}

async function поднять() {
  const m = await import("../src/lib/multichatGuestPass");
  const a = express();
  a.get("/api/multichat-guest/allowance", m.ручкаОстатка);
  return { a, m };
}
const спросить = (a: express.Express, адрес: string, устройство: string) =>
  request(a).get("/api/multichat-guest/allowance").set("x-forwarded-for", адрес).set("x-aevion-device", устройство);

describe("счёт гостя переживает перезапуск (лежит в базе)", () => {
  test("гость потратил 2 → перезапуск модуля → у того же устройства и адреса по-прежнему 0", async () => {
    const { m } = await поднять();
    const r = запрос("10.7.7.7", "dev-restart");
    await m.засчитатьГостю(r);
    await m.засчитатьГостю(r);
    expect((await m.остатокГостя(r)).осталось, "до перезапуска").toBe(0);
    expect(база.строки.size, "в базе должны лежать строки ip: и dev:").toBe(2);

    // «Перезапуск»: память модуля пропадает целиком, база остаётся.
    vi.resetModules();
    const { m: m2 } = await поднять();
    expect(m2).not.toBe(m);
    const после = await m2.остатокГостя(запрос("10.7.7.7", "dev-restart"));
    expect(после.осталось, "после перезапуска норма снова 2 — счёт был в памяти, а не в базе").toBe(0);
    expect(после.использовано).toBe(2);
    expect(error, "база отвечала — строки о сбое быть не должно").not.toHaveBeenCalled();
  });

  test("после перезапуска и ручка остатка отвечает 0 тому же устройству; чужому — 2", async () => {
    const { m } = await поднять();
    await m.засчитатьГостю(запрос("10.8.8.8", "dev-A"));
    await m.засчитатьГостю(запрос("10.8.8.8", "dev-A"));

    vi.resetModules();
    const { a } = await поднять();
    const своё = await спросить(a, "10.8.8.8", "dev-A");
    expect(своё.status).toBe(200);
    expect(своё.body.осталось).toBe(0);
    const чужое = await спросить(a, "10.8.8.8", "dev-B");
    expect(чужое.body.осталось, "другое устройство того же адреса — своя норма, потолок адреса цел").toBe(2);
  });

  test("вошедший считается по user-ключу в базе и тоже переживает перезапуск", async () => {
    process.env.AUTH_JWT_SECRET = "test-secret-at-least-32-chars-long-aevion-000";
    const jwt = (await import("jsonwebtoken")).default;
    const токен = jwt.sign({ sub: "user-77", email: "u77@example.test" }, process.env.AUTH_JWT_SECRET, { algorithm: "HS256" });
    const вошедший = () => {
      const headers: Record<string, string> = { authorization: `Bearer ${токен}`, "x-aevion-device": "dev-U" };
      return { headers, get(h: string) { return headers[h.toLowerCase()]; }, socket: { remoteAddress: "10.9.9.9" }, ip: "10.9.9.9", body: {} } as any;
    };
    try {
      const { m } = await поднять();
      await m.засчитатьГостю(вошедший());
      await m.засчитатьГостю(вошедший());
      expect([...база.строки.keys()].some((k) => k.startsWith("user:user-77:")), "ключ вошедшего в базе").toBe(true);
      vi.resetModules();
      const { m: m2 } = await поднять();
      expect((await m2.остатокГостя(вошедший())).осталось).toBe(0);
    } finally {
      delete process.env.AUTH_JWT_SECRET;
    }
  });
});

describe("откат: база недоступна — считаем в памяти, гостя не запираем", () => {
  test("запрос к базе падает → 200, по умолчанию 2, траты видны в памяти, console.error ровно один раз", async () => {
    база.ломать = true;
    const { a, m } = await поднять();

    const первый = await спросить(a, "10.5.5.5", "dev-fallback");
    expect(первый.status, "сбой базы не должен давать 5xx").toBe(200);
    expect(первый.body.осталось, "сбой базы не должен давать 0 — гость получает свою норму").toBe(2);

    const r = запрос("10.5.5.5", "dev-fallback");
    await m.засчитатьГостю(r);
    await m.засчитатьГостю(r);
    const после = await спросить(a, "10.5.5.5", "dev-fallback");
    expect(после.status).toBe(200);
    expect(после.body.осталось, "в памяти счёт должен вестись как раньше").toBe(0);
    expect(база.строки.size, "в базу ничего не легло").toBe(0);

    expect(база.запросов, "к базе обращались (не бросили пробовать)").toBeGreaterThan(1);
    const строки = error.mock.calls.filter((c: unknown[]) => String(c[0]).includes("СЧЁТ ГОСТЯ НЕ В БАЗЕ"));
    expect(строки, "одна строка на процесс, не на запрос").toHaveLength(1);
  });

  test("getPool() бросает (нет базы) → тот же откат в память, одна строка в журнале", async () => {
    база.бросатьВGetPool = true;
    const { a, m } = await поднять();
    expect((await спросить(a, "10.6.6.6", "dev-nopool")).body.осталось).toBe(2);
    await m.засчитатьГостю(запрос("10.6.6.6", "dev-nopool"));
    expect((await спросить(a, "10.6.6.6", "dev-nopool")).body.осталось).toBe(1);
    const строки = error.mock.calls.filter((c: unknown[]) => String(c[0]).includes("СЧЁТ ГОСТЯ НЕ В БАЗЕ"));
    expect(строки).toHaveLength(1);
  });

  test("КОНТРОЛЬ: база ожила — счёт читается из неё, а не из памяти", async () => {
    const { m } = await поднять();
    база.ломать = true;
    await m.засчитатьГостю(запрос("10.4.4.4", "dev-recover")); // только память
    база.ломать = false;
    // База пуста по этому ключу → из неё остаток 2; память (1 трата) не главенствует.
    expect((await m.остатокГостя(запрос("10.4.4.4", "dev-recover"))).осталось).toBe(2);
    await m.засчитатьГостю(запрос("10.4.4.4", "dev-recover"));
    expect((await m.остатокГостя(запрос("10.4.4.4", "dev-recover"))).осталось, "трата при живой базе легла в базу").toBe(1);
  });
});
