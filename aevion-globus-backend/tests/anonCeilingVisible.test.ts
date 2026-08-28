import { describe, test, expect } from "vitest";
import express from "express";
import request from "supertest";

import { anonChatCeiling, exposeCeilingRemaining } from "../src/routes/qcoreai.js";

// ОТДЕЛЬНЫЙ файл: корзина потолка живёт в модуле, и соседний тест на 130
// обращений израсходовал бы её — проверка «остаток больше сотни» упала бы не
// потому, что перенос сломан. Второй раз за ночь тот же урок.
describe("остаток потолка виден снаружи", () => {
  test("после потолка появляется отдельный заголовок с его остатком", async () => {
    const a = express();
    a.get("/y", anonChatCeiling, exposeCeilingRemaining as never, (_req, res) => {
      // Следующий лимитер затирает общий заголовок — ровно как в бою.
      res.setHeader("X-RateLimit-Remaining", "29");
      res.json({ ok: true });
    });
    const r = await request(a).get("/y");
    expect(r.headers["x-anon-ceiling-remaining"], "остаток потолка не виден").toBeDefined();
    expect(Number(r.headers["x-anon-ceiling-remaining"])).toBeGreaterThan(100);
    expect(r.headers["x-ratelimit-remaining"]).toBe("29");
  });
});
