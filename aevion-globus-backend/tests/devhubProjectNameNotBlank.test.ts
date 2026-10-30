import { describe, test, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Имя проекта DevHub из одних пробелов — отказ, а не проект без имени.
 * Замер прода 30.10.2026: {"name":"   "} → 201 и project.name="" (ниже стоит
 * name.trim()), тогда как {"name":""} → 400 «name is required». Ворота 4:
 * неверный ввод → 4xx с текстом, а не тихий успех.
 */
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: async () => { throw new Error("нет базы"); } }),
  getPoolStats: () => null,
}));
vi.mock("../src/lib/ensureDevHubTables", () => ({
  ensureDevHubTables: vi.fn().mockResolvedValue(undefined),
  isDevHubDbReady: () => false,
}));
import { devhubRouter, __resetDevHubStore } from "../src/routes/devhub";

function приложение() {
  const app = express();
  app.use(express.json());
  app.use("/api/devhub", devhubRouter);
  return app;
}

describe("имя проекта не бывает пустым после trim", () => {
  beforeEach(() => { __resetDevHubStore?.(); });
  test("одни пробелы → 400 name is required", async () => {
    const r = await request(приложение()).post("/api/devhub/projects").send({ name: "   ", description: "x" });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe("name is required");
  });
  test("контроль: пустая строка → 400, как и раньше", async () => {
    const r = await request(приложение()).post("/api/devhub/projects").send({ name: "" });
    expect(r.status).toBe(400);
  });
  test("контроль: нормальное имя с пробелами по краям → 201, имя обрезано", async () => {
    const r = await request(приложение()).post("/api/devhub/projects").send({ name: "  проба  " });
    expect([200, 201]).toContain(r.status);
    expect(r.body.project.name).toBe("проба");
  });
});
