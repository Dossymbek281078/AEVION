/**
 * QGood — повторная запись одного и того же платежа.
 *
 * До 28.07.2026 у paymentRef не было уникального индекса, а вставка шла без
 * проверки результата. Повтор вебхука, обновление страницы подтверждения или
 * ретрай клиента добавляли ВТОРУЮ строку пожертвования и второй раз двигали
 * raisedCents с donorCount. Публичная кампания показывала деньги, которых
 * никто не давал, а матчинг-фонд списывался повторно.
 *
 * Здесь проверяется логика маршрута. Сам SQL (частичный уникальный индекс и
 * ON CONFLICT по нему) на живой базе НЕ прогонялся — локальных доступов к
 * Postgres в этой сессии нет.
 */
import { describe, test, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";

const { sqlLog, mockQuery } = vi.hoisted(() => ({ sqlLog: [] as string[], mockQuery: vi.fn() }));

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: mockQuery, connect: async () => ({ query: mockQuery, release: () => {} }) }),
}));

// eslint-disable-next-line import/first
import { qgoodRouter } from "../src/routes/qgood";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/qgood", qgoodRouter);
  return app;
}

/** `duplicate` — база отбросила вставку как повтор платежа. */
function stubDb(opts: { duplicate: boolean; campaignActive?: boolean }) {
  const { duplicate, campaignActive = true } = opts;
  mockQuery.mockImplementation(async (sql: string) => {
    sqlLog.push(sql.trim().split("\n")[0].trim());
    if (sql.includes("CREATE ") || sql.includes("ALTER ")) return { rows: [], rowCount: 0 };
    if (sql.includes('FROM "QGoodCampaign"') && sql.includes('"status"')) {
      return campaignActive
        ? { rows: [{ status: "active", currency: "USD" }], rowCount: 1 }
        : { rows: [{ status: "closed", currency: "USD" }], rowCount: 1 };
    }
    if (sql.includes('INSERT INTO "QGoodDonation"')) {
      return duplicate ? { rows: [], rowCount: 0 } : { rows: [{ id: "don-new" }], rowCount: 1 };
    }
    if (sql.includes('SELECT "id" FROM "QGoodDonation"')) {
      return { rows: [{ id: "don-original" }], rowCount: 1 };
    }
    if (sql.includes('"raisedCents","donorCount"')) {
      return { rows: [{ raisedCents: 5000, donorCount: 1 }], rowCount: 1 };
    }
    if (sql.includes("QGoodMatchingPool")) return { rows: [], rowCount: 0 };
    return { rows: [], rowCount: 1 };
  });
}

let ipSeq = 0;
const donate = (paymentRef: string | null = "pay_A") =>
  request(makeApp())
    .post("/api/qgood/campaigns/c-1/donations")
    .set("X-Forwarded-For", `198.51.100.${(ipSeq += 1)}`)
    .send({ amountCents: 5000, currency: "USD", paymentRef });

const raised = () => sqlLog.filter((s) => s.includes('UPDATE "QGoodCampaign"')).length;

beforeEach(() => {
  sqlLog.length = 0;
  mockQuery.mockReset();
  ipSeq += 1;
});

describe("один платёж — одна запись и одно начисление", () => {
  test("первое пожертвование записывается и двигает сумму", async () => {
    stubDb({ duplicate: false });
    const res = await donate();
    expect(res.status).toBe(201);
    expect(raised()).toBe(1);
  });

  test("повтор того же платежа НЕ двигает сумму кампании", async () => {
    stubDb({ duplicate: true });
    const res = await donate();
    expect(res.status).toBe(200);
    expect(raised()).toBe(0);
  });

  test("повтор помечен как duplicate и отдаёт ИСХОДНЫЙ идентификатор", async () => {
    stubDb({ duplicate: true });
    const res = await donate();
    expect(res.body.duplicate).toBe(true);
    expect(res.body.donationId).toBe("don-original");
  });

  test("повтор возвращает текущие итоги кампании, а не выдуманные", async () => {
    stubDb({ duplicate: true });
    const res = await donate();
    expect(res.body.raisedCents).toBe(5000);
    expect(res.body.donorCount).toBe(1);
  });

  test("повтор не трогает матчинг-фонд", async () => {
    stubDb({ duplicate: true });
    await donate();
    expect(sqlLog.some((s) => s.includes("QGoodMatchingPool"))).toBe(false);
  });

  test("вставка спрашивает RETURNING — иначе повтор неотличим от успеха", async () => {
    stubDb({ duplicate: false });
    await donate();
    const insert = mockQuery.mock.calls.map((c) => String(c[0])).find((s) => s.includes('INSERT INTO "QGoodDonation"'));
    expect(insert).toMatch(/RETURNING/i);
    expect(insert).toMatch(/ON CONFLICT/i);
  });

  test("закрытая кампания не принимает пожертвование", async () => {
    stubDb({ duplicate: false, campaignActive: false });
    const res = await donate();
    expect(res.status).toBe(400);
    expect(raised()).toBe(0);
  });
});
