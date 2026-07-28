import { describe, test, expect, beforeEach, vi } from "vitest";
import crypto from "crypto";
import request from "supertest";
import express from "express";

/**
 * Создание вакансии проверяло только наличие трёх полей. Ни длины, ни тип
 * занятости, ни навыки:
 *
 *  - описание на мегабайт уходило в базу и ломало вёрстку карточки;
 *  - неизвестный тип занятости подменялся на "full-time" МОЛЧА — работодатель
 *    видел в форме одно, а в вакансии оказывалось другое;
 *  - навыки принимались списком любой длины и с любыми строками.
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

const AUTH = `Bearer ${signJwt({ sub: "employer-1", email: "e@test.aev", role: "USER" })}`;
const OK = { title: "Инженер", description: "описание вакансии", company: "AEVION" };

const post = (body: unknown) =>
  request(makeApp()).post("/api/qjobs/me/jobs").set("Authorization", AUTH).send(body as object);

describe("QJobs: ввод при создании вакансии проверяется", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
  });

  test("нормальная вакансия создаётся", async () => {
    expect((await post({ ...OK, type: "contract", skills: ["ts", "sql"] })).status).toBe(201);
  });

  test("слишком длинное описание отбивается", async () => {
    const res = await post({ ...OK, description: "x".repeat(20_001) });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("description too long");
  });

  test("слишком длинное название и компания отбиваются", async () => {
    expect((await post({ ...OK, title: "x".repeat(201) })).status).toBe(400);
    expect((await post({ ...OK, company: "x".repeat(201) })).status).toBe(400);
  });

  test("неизвестный тип занятости отбивается, а не подменяется молча", async () => {
    const res = await post({ ...OK, type: "вахтой" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("unknown type");
  });

  test("навыки строкой вместо массива отбиваются", async () => {
    expect((await post({ ...OK, skills: "ts, sql" })).status).toBe(400);
  });

  test("слишком много навыков отбивается", async () => {
    const res = await post({ ...OK, skills: Array.from({ length: 31 }, (_, i) => `навык-${i}`) });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/skills/);
  });

  test("слишком длинный навык отбивается", async () => {
    expect((await post({ ...OK, skills: ["x".repeat(61)] })).status).toBe(400);
  });
});
