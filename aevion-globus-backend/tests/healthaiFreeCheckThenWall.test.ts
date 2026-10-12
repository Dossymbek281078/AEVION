import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";

/**
 * HealthAI: один бесплатный симптом-чек гостю, дальше стена — и только по
 * слову основателя (healthai_check в PAID_ACTIONS). Замер прода 12.10.2026:
 * гость получал 402 уже на «Создать профиль» (окно Приложения-31.12).
 */

const actors: string[] = [];
let used = 0;
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: async (sql: string, params?: unknown[]) => {
      if (/FreeActionUsage/.test(sql) && /INSERT/i.test(sql)) {
        actors.push(String(params?.[0]));
        used += 1;
        return { rows: [{ count: used }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
  }),
}));
vi.mock("../src/lib/rateLimit", async (orig) => ({
  ...(await orig<typeof import("../src/lib/rateLimit")>()),
  rateLimit: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const { пробныйПуть } = await import("../src/lib/planGate");
const { учестьДействие } = await import("../src/lib/freeActionQuota");

const старое = process.env.PAID_ACTIONS;
beforeEach(() => { actors.length = 0; used = 0; });
afterEach(() => { if (старое === undefined) delete process.env.PAID_ACTIONS; else process.env.PAID_ACTIONS = старое; });

describe("HealthAI: пробные пути открываются только словом основателя", () => {
  test("КОНТРОЛЬ: без PAID_ACTIONS ничего не открыто — выкатка ничего не меняет", () => {
    delete process.env.PAID_ACTIONS;
    expect(пробныйПуть("healthai", { method: "POST", path: "/check" })).toBe(false);
    expect(пробныйПуть("healthai", { method: "POST", path: "/profile" })).toBe(false);
  });

  test("с healthai_check открыты ровно POST /profile и POST /check", () => {
    process.env.PAID_ACTIONS = "bureau_verify,healthai_check";
    expect(пробныйПуть("healthai", { method: "POST", path: "/check" })).toBe(true);
    expect(пробныйПуть("healthai", { method: "POST", path: "/profile/" })).toBe(true);
    expect(пробныйПуть("healthai", { method: "GET", path: "/profiles/me" })).toBe(true);
    expect(пробныйПуть("healthai", { method: "GET", path: "/trends/x" })).toBe(false);
    expect(пробныйПуть("healthai", { method: "POST", path: "/log" })).toBe(false);
    expect(пробныйПуть("qfusionai", { method: "POST", path: "/check" })).toBe(false);
  });
});

describe("HealthAI /check: вторая проверка гостя упирается в норму", () => {
  test("первая — совет, вторая — отказ по норме", async () => {
    process.env.PAID_ACTIONS = "healthai_check";
    process.env.FREE_HEALTHAI_CHECK_PER_MONTH = "1";
    delete process.env.DATABASE_URL;
    const { healthaiRouter } = await import("../src/routes/healthai");
    const app = express();
    app.use(express.json());
    app.use(healthaiRouter);
    const p = await request(app).post("/profile").send({ age: 30, sex: "other", heightCm: 170, weightKg: 70 });
    const id = p.body.profile.id;
    const r1 = await request(app).post("/check").send({ profileId: id, symptoms: ["головная боль"] });
    expect(r1.status, JSON.stringify(r1.body)).toBe(200);
    const r2 = await request(app).post("/check").send({ profileId: id, symptoms: ["головная боль"] });
    expect(r2.status, JSON.stringify(r2.body)).toBe(402);
    // пустой запрос норму не съедает
    const before = used;
    await request(app).post("/check").send({ profileId: id, symptoms: [] });
    expect(used).toBe(before);
  });
});

describe("норма не обнуляется поддельным X-Forwarded-For", () => {
  test("гость с чужим адресом в заголовке считается по своему соединению", async () => {
    process.env.PAID_ACTIONS = "healthai_check";
    const req = (xff: string) => ({
      method: "POST", path: "/check", headers: { "x-forwarded-for": xff },
      socket: { remoteAddress: "203.0.113.7" },
    }) as any;
    await учестьДействие(req("1.1.1.1"), "healthai_check");
    await учестьДействие(req("9.9.9.9"), "healthai_check");
    expect(actors.length).toBe(2);
    expect(actors[0], "ключ взят из заголовка клиента").not.toContain("1.1.1.1");
    expect(actors[0]).toBe(actors[1]);
  });
});
