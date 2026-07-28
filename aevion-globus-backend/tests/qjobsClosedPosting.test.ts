import { describe, test, expect, beforeEach, vi } from "vitest";
import crypto from "crypto";
import request from "supertest";
import express from "express";

/**
 * Пятый случай одного перекоса за день: правило видимости написано в списке и
 * не написано в выдаче по идентификатору.
 *
 * Список вакансий начинается с `const conditions = ['"isActive"=TRUE']`, путь
 * через память фильтрует `.filter((j) => j.isActive)`. А `GET /jobs/:id` не
 * смотрел на признак вовсе — закрытая вакансия открывалась по прямой ссылке.
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

const EMPLOYER = "user-employer";
const employerToken = `Bearer ${signJwt({ sub: EMPLOYER, email: "e@test.aev", role: "USER" })}`;
const strangerToken = `Bearer ${signJwt({ sub: "user-stranger", email: "s@test.aev", role: "USER" })}`;

function serveJob(isActive: boolean) {
  mockQuery.mockReset();
  mockQuery.mockImplementation(async (sql: string) => {
    if (String(sql).includes('FROM "QJobsPosting"') && String(sql).includes('"id"=$1')) {
      return {
        rows: [
          {
            id: "job-1",
            employerId: EMPLOYER,
            title: "Инженер",
            description: "описание",
            company: "AEVION",
            location: "Астана",
            type: "full-time",
            salary: null,
            skills: [],
            isActive,
            applicantCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            // служебное поле «завтрашней» схемы
            internalRating: 4.2,
          },
        ],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 0 };
  });
}

const get = (token?: string) => {
  const r = request(makeApp()).get("/api/qjobs/jobs/job-1");
  return token ? r.set("Authorization", token) : r;
};

describe("QJobs: закрытая вакансия не открывается по прямой ссылке", () => {
  beforeEach(() => mockQuery.mockReset());

  test("закрытая вакансия посторонним не отдаётся — и без входа тоже", async () => {
    serveJob(false);
    expect((await get()).status).toBe(404);
    serveJob(false);
    expect((await get(strangerToken)).status).toBe(404);
  });

  test("работодатель свою закрытую вакансию видит", async () => {
    serveJob(false);
    const res = await get(employerToken);
    expect(res.status).toBe(200);
    expect(res.body.job.id).toBe("job-1");
  });

  test("открытая вакансия доступна кому угодно", async () => {
    serveJob(true);
    expect((await get()).status).toBe(200);
  });

  test("служебные поля наружу не уходят", async () => {
    serveJob(true);
    const res = await get();
    expect(res.body.job).not.toHaveProperty("internalRating");
  });

  test("запрос перечисляет поля, а не берёт всё подряд", async () => {
    serveJob(true);
    await get();
    const sql = mockQuery.mock.calls.map((c) => String(c[0])).find((q) => q.includes('FROM "QJobsPosting"'));
    expect(sql).not.toMatch(/SELECT\s+\*/i);
    expect(sql).toContain('"title"');
  });
});
