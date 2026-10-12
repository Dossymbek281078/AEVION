import { describe, test, expect, beforeAll, vi } from "vitest";
import request from "supertest";
import express from "express";

/**
 * Что получает человек, КУПИВШИЙ подписку, в HealthAI: профиль → симптом-чек → совет.
 *
 * Замер 12.10.2026 (окно Приложения-31.12): на проде гость упирается в стену уже
 * на «Создать профиль» (402), а платного входа для замера нет. До этого теста
 * ни одна проверка не проходила главный путь модуля — только обрезку строк.
 * Роутер монтируется без стены: стену проверяет planGate, здесь — то, что за ней.
 */

vi.mock("../src/lib/rateLimit", () => ({
  rateLimit: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

let app: express.Express;

beforeAll(async () => {
  delete process.env.DATABASE_URL; // память процесса, без боевой базы
  const { healthaiRouter } = await import("../src/routes/healthai");
  app = express();
  app.use(express.json());
  app.use(healthaiRouter);
});

async function профиль(): Promise<string> {
  const r = await request(app).post("/profile").send({
    memberLabel: "Тест", age: 40, sex: "other", heightCm: 178, weightKg: 80,
  });
  expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
  const id = r.body?.profile?.id;
  expect(typeof id, "профиль не вернул id").toBe("string");
  return id;
}

describe("HealthAI за стеной: главный путь работает", () => {
  test("русские симптомы дают совет по каждому, а не общий текст", async () => {
    const id = await профиль();
    const r = await request(app).post("/check").send({
      profileId: id, symptoms: ["головная боль", "слабость"], severity: 4, durationH: 24,
    });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const ключи = (r.body.check.matched as { keyword: string }[]).map((m) => m.keyword).sort();
    expect(ключи).toEqual(["fatigue", "headache"]);
    expect(r.body.check.disclaimer).toBeTruthy();
  });

  test("боль в груди помечается как срочная — это обещание безопасности", async () => {
    const id = await профиль();
    const r = await request(app).post("/check").send({ profileId: id, symptoms: ["боль в груди"] });
    expect(r.status).toBe(200);
    const m = r.body.check.matched as { keyword: string; urgency: string }[];
    expect(m.length).toBe(1);
    expect(m[0].urgency).toBe("urgent");
  });

  test("КОНТРОЛЬ: пустые симптомы — отказ, а не пустой «совет»", async () => {
    const id = await профиль();
    const r = await request(app).post("/check").send({ profileId: id, symptoms: [] });
    expect(r.status).toBe(400);
  });
});
