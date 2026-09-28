import { describe, test, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Умолчание стека в API обязано быть тем, что реально ОЖИВАЕТ.
 *
 * Замер на живом проде 28.09.2026: стек next публиковался с ok:true и liveUrl, а адрес
 * отдавал 404 и через 160 секунд (Cloudflare Pages отдаёт файлы как есть и ничего не
 * собирает); react — 404 за 155 с, express — 404 за 163 с, static — 200 за 45 с.
 * На сайте выбор стека в тот же день починен, а в API оставалось `stack = "next"`: кто
 * зовёт ручку напрямую — наши съёмки роликов, любой читатель документации — по умолчанию
 * получал стек с мёртвым адресом. Нашло окно демо агентства прогоном на проде.
 */
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: async () => { throw new Error("нет базы"); } }),
  getPoolStats: () => null,
}));
vi.mock("../src/lib/ensureDevHubTables", () => ({
  ensureDevHubTables: vi.fn().mockResolvedValue(undefined),
  isDevHubDbReady: () => false,
}));

// eslint-disable-next-line import/first
import { devhubRouter, __resetDevHubStore } from "../src/routes/devhub";

function приложение() {
  const app = express();
  app.use(express.json());
  app.use("/api/devhub", devhubRouter);
  return app;
}

describe("стек по умолчанию в API", () => {
  beforeEach(() => { __resetDevHubStore?.(); });

  test("без поля stack создаётся static, а не next", async () => {
    const r = await request(приложение())
      .post("/api/devhub/projects")
      .send({ name: "проба умолчания", description: "таймер на 10 минут" });
    expect([200, 201]).toContain(r.status);
    expect(r.body.project.stack).toBe("static");
  });

  test("неизвестный стек тоже сводится к static: незнание не публикует мёртвое", async () => {
    const r = await request(приложение())
      .post("/api/devhub/projects")
      .send({ name: "проба мусора", stack: "вертолёт" });
    expect([200, 201]).toContain(r.status);
    expect(r.body.project.stack).toBe("static");
  });

  test("явно названный стек уважается — выбор человека не подменяем", async () => {
    for (const stack of ["next", "express", "react", "python", "static"]) {
      const r = await request(приложение())
        .post("/api/devhub/projects")
        .send({ name: "проба " + stack, stack });
      expect([200, 201]).toContain(r.status);
      expect(r.body.project.stack, stack).toBe(stack);
    }
  });
});
