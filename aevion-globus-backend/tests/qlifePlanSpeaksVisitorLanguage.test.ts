import { describe, test, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

/**
 * План долголетия — на языке посетителя и в метрических единицах.
 * Замер 12.10.2026 (окно Приложения-31.12): русская страница /qlife выдавала
 * гостю план по-английски, с температурой в °F, и с подписью «via anthropic».
 * Сторож идёт через настоящую ручку /plan и смотрит, что ушло модели.
 */

const sent: { role: string; content: string }[][] = [];
vi.mock("../src/services/qcoreai/providers", () => ({
  resolveProvider: () => "stub",
  getProviders: () => [{ id: "stub", defaultModel: "m" }],
  callProvider: async (_id: string, messages: { role: string; content: string }[]) => {
    sent.push(messages);
    return { reply: '[{"goal":"sleep","recommendation":"r","frequency":"f","expected_benefit":"b"}]', model: "m" };
  },
}));
vi.mock("../src/lib/rateLimit", () => ({
  rateLimit: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const { qlifeRouter, языкПлана } = await import("../src/routes/qlife");
const app = express();
app.use(express.json());
app.use(qlifeRouter);

const системная = () => sent[sent.length - 1].find((m) => m.role === "system")!.content;

beforeEach(() => { sent.length = 0; });

describe("план QLife говорит на языке посетителя", () => {
  test("русская страница → план по-русски и в метрических единицах", async () => {
    const r = await request(app).post("/plan").send({ age: 42, goals: ["sleep"], lang: "ru" });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(системная()).toContain("in Russian");
    expect(системная()).toMatch(/metric units/);
  });

  test("английская страница → по-английски; без языка → русский (основная аудитория)", async () => {
    await request(app).post("/plan").send({ age: 42, goals: ["sleep"], lang: "en" });
    expect(системная()).toContain("in English");
    await request(app).post("/plan").send({ age: 42, goals: ["sleep"] });
    expect(системная()).toContain("in Russian");
  });

  test("КОНТРОЛЬ разбора языка", () => {
    expect(языкПлана("kk")).toBe("Kazakh");
    expect(языкПлана("EN-us")).toBe("English");
    expect(языкПлана(42)).toBe("Russian");
  });
});
