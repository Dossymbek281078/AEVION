import { describe, test, expect, vi } from "vitest";
import request from "supertest";
import express from "express";

/*
 * Ветвь ПАМЯТИ той же статистики (база недоступна, storage=memory): наши
 * проекты отделяются от людей и здесь. Пара к deployStatsRazdelyayutNashi
 * (ветвь базы): мутация «не считать наши проекты в памяти» там выживала —
 * ветвь не была под надзором. Проекты заводятся настоящим POST без входа
 * (гость), как это делает человек с лендинга.
 */
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: async () => ({ rows: [] }) }),
}));
vi.mock("../src/lib/ensureDevHubTables", () => ({
  ensureDevHubTables: vi.fn().mockResolvedValue(undefined),
  isDevHubDbReady: () => false,
  getDevHubDbError: () => new Error("тест: база выключена"),
}));

async function app() {
  const { devhubRouter } = await import("../src/routes/devhub");
  const a = express();
  a.use(express.json());
  a.use("/api/devhub", devhubRouter);
  return a;
}

describe("статистика выкаток в памяти отделяет наши проекты от людей", () => {
  test("🔴 два гостевых проекта: с меткой probe- наш, с меткой ролика — человек", async () => {
    const a = await app();
    const наш = await request(a).post("/api/devhub/projects").send({ name: "Кофейня", stack: "static", entryTag: "probe-bd" });
    expect(наш.status, JSON.stringify(наш.body)).toBeLessThan(300);
    const человек = await request(a).post("/api/devhub/projects").send({ name: "Портфолио", stack: "static", entryTag: "yt-devhub-1" });
    expect(человек.status, JSON.stringify(человек.body)).toBeLessThan(300);

    const r = await request(a).get("/api/devhub/studio/deploy-stats?days=7");
    expect(r.status).toBe(200);
    expect(r.body.storage).toBe("memory");
    expect(r.body.projects).toEqual({ total: 2, ours: 1, people: 1 });
    // выкаток не было — и наших тоже ноль, не выдуманное число
    expect(r.body.ours).toEqual({ total: 0, live: 0 });
    expect(r.body.people.successRate).toBeNull();
  });
});
