/**
 * QJobs — повторный отклик в ветке Postgres.
 *
 * До 28.07.2026 прод и dev расходились молча. В памяти дубль честно давал
 * 409, а в Postgres `ON CONFLICT DO NOTHING` без RETURNING отбрасывал заявку
 * беззвучно, после чего роутер всё равно увеличивал applicantCount и отдавал
 * 201 с идентификатором записи, которой не существует. Работодатель видел
 * число откликов больше, чем самих откликов, и это ничем не сопровождалось.
 */
import { describe, test, expect, beforeEach, vi } from "vitest";
import crypto from "crypto";
import request from "supertest";
import express from "express";

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

const { sqlLog, mockQuery } = vi.hoisted(() => ({ sqlLog: [] as string[], mockQuery: vi.fn() }));

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: mockQuery, connect: async () => ({ query: mockQuery, release: () => {} }) }),
}));

vi.mock("../src/lib/ensureQJobsTables", () => ({
  isQJobsDbReady: () => true,
  getQJobsDbError: () => null,
  ensureQJobsTables: async () => {},
}));

// eslint-disable-next-line import/first
import { qjobsRouter } from "../src/routes/qjobs";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/qjobs", qjobsRouter);
  return app;
}

/** `duplicate` — база отбрасывает вставку как дубль (пустой RETURNING). */
function stubDb(opts: { jobExists?: boolean; duplicate: boolean }) {
  const { jobExists = true, duplicate } = opts;
  mockQuery.mockImplementation(async (sql: string) => {
    sqlLog.push(sql.trim().split("\n")[0].trim());
    if (sql.includes('FROM "QJobsPosting"')) {
      return jobExists ? { rows: [{ id: "job-1" }], rowCount: 1 } : { rows: [], rowCount: 0 };
    }
    if (sql.includes('INSERT INTO "QJobsApplication"')) {
      return duplicate ? { rows: [], rowCount: 0 } : { rows: [{ id: "app-1" }], rowCount: 1 };
    }
    return { rows: [], rowCount: 1 };
  });
}

const token = signJwt({ sub: "user-1", email: "a@b.c" });

/**
 * Каждый запрос идёт со своего адреса. Ручка отклика ограничена пятью
 * попытками в минуту на IP, и без этого шестой тест получал 429 вместо
 * ожидаемого ответа — то есть падал бы не по своей причине и в зависимости
 * от порядка запуска.
 */
let ipSeq = 0;
const fromFreshIp = () => `203.0.113.${(ipSeq += 1)}`;

const apply = () =>
  request(makeApp())
    .post("/api/qjobs/jobs/job-1/apply")
    .set("X-Forwarded-For", fromFreshIp())
    .set("Authorization", `Bearer ${token}`)
    .send({});

beforeEach(() => {
  sqlLog.length = 0;
  mockQuery.mockReset();
});

describe("повторный отклик не проходит и не накручивает счётчик", () => {
  test("дубль даёт 409, а не мнимый успех", async () => {
    stubDb({ duplicate: true });
    const res = await apply();
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ error: "already applied" });
  });

  test("на дубле applicantCount НЕ увеличивается", async () => {
    stubDb({ duplicate: true });
    await apply();
    expect(sqlLog.some((s) => s.includes('UPDATE "QJobsPosting"'))).toBe(false);
  });

  test("первый отклик проходит и увеличивает счётчик ровно один раз", async () => {
    stubDb({ duplicate: false });
    const res = await apply();
    expect(res.status).toBe(201);
    expect(res.body.applicationId).toBeTruthy();
    expect(sqlLog.filter((s) => s.includes('UPDATE "QJobsPosting"')).length).toBe(1);
  });

  test("вставка спрашивает RETURNING — иначе дубль неотличим от успеха", async () => {
    stubDb({ duplicate: false });
    await apply();
    const insert = sqlLog.find((s) => s.includes('INSERT INTO "QJobsApplication"'));
    const full = mockQuery.mock.calls.map((c) => String(c[0])).find((s) => s.includes("INSERT INTO"));
    expect(insert).toBeTruthy();
    expect(full).toMatch(/RETURNING/i);
  });

  test("несуществующая вакансия — 404, без вставки", async () => {
    stubDb({ jobExists: false, duplicate: false });
    const res = await apply();
    expect(res.status).toBe(404);
    expect(sqlLog.some((s) => s.includes("INSERT INTO"))).toBe(false);
  });

  test("без токена — 401, до базы дело не доходит", async () => {
    stubDb({ duplicate: false });
    const res = await request(makeApp())
      .post("/api/qjobs/jobs/job-1/apply")
      .set("X-Forwarded-For", fromFreshIp())
      .send({});
    expect(res.status).toBe(401);
    expect(sqlLog).toEqual([]);
  });
});
