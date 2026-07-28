import { describe, test, expect, beforeEach, vi } from "vitest";
import crypto from "crypto";
import request from "supertest";
import express from "express";

/**
 * Повторный отклик на вакансию: вставка стоит с `ON CONFLICT DO NOTHING`, то
 * есть второй раз запись не создаётся. А счётчик откликов увеличивался следом
 * ВСЕГДА — и число на карточке вакансии росло от одного человека, нажавшего
 * дважды. В ответ при этом приходил 201 с номером заявки, которой в базе нет.
 *
 * Путь через память тут же рядом отвечал 409 «already applied»: правило было
 * написано в одном пути и забыто в другом — тот же перекос, что и с видимостью
 * закрытой вакансии.
 */

function signJwt(payload: Record<string, unknown>, secret = "dev-auth-secret"): string {
  const b64 = (s: string) =>
    Buffer.from(s).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const header = b64(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000) }));
  const sig = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `${header}.${body}.${sig}`;
}

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: mockQuery }) }));

// eslint-disable-next-line import/first
import { qjobsRouter } from "../src/routes/qjobs";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/qjobs", qjobsRouter);
  return app;
}

/** Запросы, которые сделал обработчик, — по ним видно, тронут ли счётчик. */
let sqlSeen: string[] = [];

/** `duplicate` = база сообщает «такая заявка уже есть» (ноль вставленных строк). */
function mockDb(duplicate: boolean) {
  sqlSeen = [];
  mockQuery.mockReset();
  mockQuery.mockImplementation(async (sql: string) => {
    sqlSeen.push(sql);
    if (/CREATE TABLE|CREATE UNIQUE|CREATE INDEX/i.test(sql)) return { rows: [], rowCount: 0 };
    if (/SELECT "id" FROM "QJobsPosting"/i.test(sql)) return { rows: [{ id: "job-1" }], rowCount: 1 };
    if (/INSERT INTO "QJobsApplication"/i.test(sql)) {
      return duplicate ? { rows: [], rowCount: 0 } : { rows: [{ id: "app-1" }], rowCount: 1 };
    }
    if (/UPDATE "QJobsPosting"/i.test(sql)) return { rows: [], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  });
}

const TOKEN = signJwt({ sub: "user-1", email: "u@example.com" });

function apply() {
  return request(makeApp())
    .post("/api/qjobs/jobs/job-1/apply")
    .set("Authorization", `Bearer ${TOKEN}`)
    .send({ coverLetter: "здравствуйте" });
}

describe("POST /jobs/:id/apply — повторный отклик", () => {
  beforeEach(() => {
    process.env.QJOBS_DB = "1";
    process.env.DATABASE_URL = process.env.DATABASE_URL || "postgres://test/test";
  });

  test("первый отклик: 201 и счётчик увеличен", async () => {
    mockDb(false);
    const res = await apply();
    expect(res.status).toBe(201);
    expect(res.body.applicationId).toBeTruthy();
    expect(sqlSeen.some((s) => /UPDATE "QJobsPosting" SET "applicantCount"/i.test(s))).toBe(true);
  });

  test("повторный отклик: 409 и счётчик НЕ тронут", async () => {
    mockDb(true);
    const res = await apply();
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("already applied");
    // Главное в этом тесте: число откликов на карточке не должно вырасти
    // от человека, который просто нажал второй раз.
    expect(
      sqlSeen.some((s) => /UPDATE "QJobsPosting" SET "applicantCount"/i.test(s)),
      "счётчик увеличили при повторном отклике",
    ).toBe(false);
  });
});
