import { describe, test, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";

/**
 * Пожертвование с одной и той же ссылкой на платёж не должно засчитываться
 * дважды. Повтор приходит не от злого умысла, а сам собой: сеть моргнула,
 * платёжная система прислала уведомление второй раз, человек нажал «оплатить»
 * ещё раз после таймаута.
 *
 * Раньше вставка шла без всякой защиты, а собранная сумма увеличивалась следом
 * безусловно — кампания показывала БОЛЬШЕ денег, чем пришло на самом деле.
 * Это ровно тот класс, что и накрутка счётчиков откликов и отметок «нравится»,
 * только на денежном пути.
 *
 * Пожертвования без ссылки на платёж (пожелания с формы) друг другу не мешают —
 * поэтому уникальность частичная.
 */

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: mockQuery }) }));

// eslint-disable-next-line import/first
import { qgoodRouter } from "../src/routes/qgood";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/qgood", qgoodRouter);
  return app;
}

let sqlSeen: string[] = [];

/** `donationInserted` — сколько строк вставила база: 0 означает «такой платёж уже есть». */
function mockDb(donationInserted: number) {
  sqlSeen = [];
  mockQuery.mockReset();
  mockQuery.mockImplementation(async (sql: string) => {
    sqlSeen.push(sql);
    if (/CREATE TABLE|CREATE INDEX|CREATE UNIQUE/i.test(sql)) return { rows: [], rowCount: 0 };
    if (/SELECT "status","currency" FROM "QGoodCampaign"/i.test(sql)) {
      return { rows: [{ status: "active", currency: "USD" }], rowCount: 1 };
    }
    if (/INSERT INTO "QGoodDonation"/i.test(sql)) {
      return donationInserted
        ? { rows: [{ id: "d-new" }], rowCount: 1 }
        : { rows: [], rowCount: 0 };
    }
    if (/SELECT "id","amountCents" FROM "QGoodDonation"/i.test(sql)) {
      return { rows: [{ id: "d-existing", amountCents: 2500 }], rowCount: 1 };
    }
    if (/FROM "QGoodMatchingPool"/i.test(sql)) return { rows: [], rowCount: 0 };
    if (/UPDATE "QGoodCampaign"/i.test(sql)) return { rows: [], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  });
}

function donate(paymentRef?: string) {
  const body: Record<string, unknown> = { amountCents: 2500, currency: "USD", anonymous: true };
  if (paymentRef) body.paymentRef = paymentRef;
  return request(makeApp()).post("/api/qgood/campaigns/c-1/donations").send(body);
}

const RAISED = /UPDATE "QGoodCampaign"[\s\S]*"raisedCents" \+ \$1/i;

describe("POST /campaigns/:id/donations — повтор платежа", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = process.env.DATABASE_URL || "postgres://test/test";
  });

  test("новый платёж: 201 и собранная сумма выросла", async () => {
    mockDb(1);
    const res = await donate("pay-1");
    expect(res.status).toBe(201);
    expect(sqlSeen.some((s) => RAISED.test(s))).toBe(true);
  });

  test("повтор того же платежа: сумма НЕ выросла", async () => {
    mockDb(0);
    const res = await donate("pay-1");
    expect(res.status).toBe(200);
    expect(res.body.duplicate).toBe(true);
    expect(res.body.id).toBe("d-existing");
    expect(
      sqlSeen.some((s) => RAISED.test(s)),
      "собранная сумма выросла на повторе платежа — кампания показывает больше, чем пришло",
    ).toBe(false);
  });

  test("защита стоит в самом запросе, а не рядом", async () => {
    mockDb(1);
    await donate("pay-1");
    const insert = sqlSeen.find((s) => /INSERT INTO "QGoodDonation"/i.test(s));
    expect(insert).toBeTruthy();
    // База в тестах заменена заглушкой, поэтому поведенческие проверки выше
    // зелёные и без защиты в запросе: решение принимает заглушка. Эта проверка
    // смотрит на сам текст запроса — без неё мутация не краснеет.
    expect(insert, "нет ON CONFLICT по ссылке на платёж").toMatch(/ON CONFLICT\s*\(\s*"paymentRef"\s*\)/i);
    expect(insert, "нет RETURNING — нечем отличить вставку от повтора").toMatch(/RETURNING/i);
  });

  test("пожертвование без ссылки на платёж проходит как обычно", async () => {
    mockDb(1);
    const res = await donate();
    expect(res.status).toBe(201);
    expect(sqlSeen.some((s) => RAISED.test(s))).toBe(true);
  });
});
