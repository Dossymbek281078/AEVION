/**
 * `/recent?limit=N` сверх предела ОБРЕЗАЕТСЯ до предела, а не молчит.
 *
 * ПОВОД (05.10.2026). Замер на живом проде:
 *   limit=20 -> 20 записей,  limit=40 -> 8,  limit=100 -> 8.
 * То есть попросить побольше означало получить ВТРОЕ МЕНЬШЕ — ручка молча
 * откатывалась к умолчанию 8. Поймалось не аудитом, а последствием: мой
 * скрипт пересборки образца просил 40, получил 8 и честно сообщил «живых
 * записей меньше пяти» — при 22 живых подписях на проде. Ошибался прибор, а не
 * реестр, и отличить одно от другого можно было только сверкой с /health.
 *
 * Это и есть тот класс отказа, который опаснее падения: ответ 200, поле
 * `items` на месте, всё выглядит успешным — а неверным становится ВЫВОД
 * вызывающего. Поэтому закрепляются обе половины:
 *   - сколько записей реально возвращается при 20 / 40 / 100;
 *   - что ответ НАЗЫВАЕТ применённый предел, то есть обрезку видно снаружи.
 */

import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";

/** Сколько строк «есть в базе» — заведомо больше любого предела. */
const ВСЕГО_В_БАЗЕ = 50;
let последнийLimit: number | null = null;

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes('"QSignSignature"') && sql.includes("LIMIT")) {
        /*
         * Заглушка ведёт себя как Postgres: отдаёт ровно столько строк,
         * сколько просит SQL. Решай она сама — сторож проверял бы заглушку, а
         * не ручку; на этом я уже попался в соседнем файле про ключи.
         */
        const n = Math.min(Number(params?.[0] ?? 0), ВСЕГО_В_БАЗЕ);
        последнийLimit = Number(params?.[0] ?? 0);
        return {
          rows: Array.from({ length: n }, (_, i) => ({
            id: `id-${i}`,
            algoVersion: "qsign-v2.0",
            hmacKid: "k1",
            ed25519Kid: "k2",
            createdAt: new Date().toISOString(),
            revokedAt: null,
            geoCountry: null,
          })),
          rowCount: n,
        };
      }
      return { rows: [], rowCount: 0 };
    }),
  }),
}));

vi.mock("../src/lib/qsignV2/ensureTables", () => ({
  ensureQSignV2Tables: vi.fn(async () => {}),
}));

/*
 * Реестр ключей к /recent отношения не имеет, но роутер импортирует его на
 * уровне модуля, и без заглушки тест падает ещё до первого запроса. Заглушка
 * пустая намеренно: подменять поведение, которое мы не проверяем, значит
 * однажды проверить именно подмену.
 */
vi.mock("../src/lib/qsignV2/keyRegistry", () => ({
  getActiveHmac: async () => ({ kid: "k1", algo: "HMAC-SHA256", secret: Buffer.alloc(32) }),
  getActiveEd25519: async () => ({ kid: "k2", algo: "Ed25519", privateKey: null, publicKeyHex: "" }),
  resolveHmac: async () => ({ kid: "k1", algo: "HMAC-SHA256", secret: Buffer.alloc(32) }),
  resolveEd25519: async () => ({ kid: "k2", algo: "Ed25519", privateKey: null, publicKeyHex: "" }),
  getKeyByKid: async () => null,
  listKeys: async () => [],
  getActiveKey: async () => null,
}));

const спросить = async (query: string) => {
  const { qsignV2Router } = await import("../src/routes/qsignV2");
  const a = express();
  a.use("/api/qsign/v2", qsignV2Router);
  return request(a).get(`/api/qsign/v2/recent${query}`);
};

describe("/recent обрезает limit, а не откатывается к умолчанию", () => {
  it("КОНТРОЛЬ: предел внутри диапазона работает как раньше", async () => {
    const r = await спросить("?limit=20");
    expect(r.status).toBe(200);
    expect(r.body.items.length).toBe(20);
  });

  it("limit=40 даёт 20, а НЕ 8", async () => {
    const r = await спросить("?limit=40");
    expect(r.body.items.length, "сверхпредельный запрос снова откатился к умолчанию").toBe(20);
  });

  it("limit=100 даёт 20, а НЕ 8", async () => {
    const r = await спросить("?limit=100");
    expect(r.body.items.length).toBe(20);
  });

  it("обрезку ВИДНО в ответе: просили 100, применили 20", async () => {
    /*
     * Половина, ради которой правка и затевалась. Вернуть 20 вместо 8 — уже
     * лучше, но вызывающий по-прежнему не знает, что его обрезали, и может
     * решить, что записей всего 20. Ответ обязан сказать это сам.
     */
    const r = await спросить("?limit=100");
    expect(r.body.limitRequested).toBe(100);
    expect(r.body.limitApplied).toBe(20);
    expect(r.body.limitMax).toBe(20);
  });

  it("без limit — прежнее умолчание 8, и это не обрезка", async () => {
    const r = await спросить("");
    expect(r.body.items.length).toBe(8);
    expect(r.body.limitRequested, "умолчание не должно выглядеть как просьба").toBeNull();
    expect(r.body.limitApplied).toBe(8);
  });

  it("мусор вместо числа — умолчание, а не падение", async () => {
    const r = await спросить("?limit=abc");
    expect(r.status).toBe(200);
    expect(r.body.items.length).toBe(8);
  });

  it("limit=0 и отрицательный поднимаются до 1, а не до нуля строк", async () => {
    /*
     * Ноль строк при status 200 — тот же молчаливый отказ: «ничего нет»
     * неотличимо от «вы попросили ничего».
     */
    expect((await спросить("?limit=0")).body.items.length).toBe(1);
    expect((await спросить("?limit=-5")).body.items.length).toBe(1);
  });

  it("в SQL уходит ровно применённый предел", async () => {
    await спросить("?limit=100");
    expect(последнийLimit, "в базу ушёл не тот предел, что назван в ответе").toBe(20);
  });
});
