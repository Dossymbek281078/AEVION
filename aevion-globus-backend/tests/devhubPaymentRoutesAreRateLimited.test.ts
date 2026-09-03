import { describe, test, expect, vi } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Ручки, создающие ПЛАТЁЖНЫЕ объекты, обязаны быть под пределом частоты.
 *
 * Замер 02.09.2026 на боевом сервере: `/media/payment-link` и
 * `/media/gumroad-checkout` отвечали на запрос без входа и не были ограничены
 * ничем. Соседнее окно 01.09 закрыло восемь ручек, зовущих платных
 * поставщиков; эти четыре в тот список не попали — они зовут не провайдера
 * модели, а кассу, и потому выпали из выборки «дорогих».
 *
 * Цена ошибки здесь не в счёте за токены, а в том, что кто угодно может
 * штамповать платёжные ссылки и кассы под нашим счётом.
 *
 * ПОЧЕМУ ОТДЕЛЬНЫЙ ФАЙЛ. Предел здесь БОЕВОЙ, без подмены переменной: если
 * глушить защиту в тестах ради удобства, она не проверяется нигде. Тот же
 * довод, что у devhubGuestLinkIsRateLimited.
 */

vi.mock("../src/lib/ensureDevHubTables", () => ({
  ensureDevHubTables: vi.fn().mockResolvedValue(undefined),
  isDevHubDbReady: () => true,
}));
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: vi.fn().mockResolvedValue({ rows: [] }) }),
  getPoolStats: () => null,
}));

describe("платёжные ручки DevHub под пределом частоты", () => {
  test("после серии запросов приходит 429 — и первые проходят", async () => {
    const { devhubRouter } = await import("../src/routes/devhub.js");
    const a = express();
    a.use(express.json());
    a.use("/api/devhub", devhubRouter);

    const kody: number[] = [];
    for (let i = 0; i < 34; i++) {
      const r = await request(a).post("/api/devhub/media/payment-link").send({});
      kody.push(r.status);
    }

    // ПОЛОЖИТЕЛЬНЫЙ КОНТРОЛЬ в той же проверке: первые запросы обязаны
    // доходить до обработчика (400 «name required»), а не отбиваться. Без него
    // тест был бы зелёным и на ручке, которая отбивает всех подряд.
    expect(kody[0], "первый запрос не дошёл до обработчика").toBe(400);
    expect(kody.filter((k) => k === 400).length, "предел бьёт по годным").toBeGreaterThan(20);

    // И собственно предел: где-то в серии обязан появиться отказ по частоте.
    expect(kody.includes(429), "предела нет: 34 запроса подряд прошли").toBe(true);
  });

  test("касса Gumroad ограничена тем же образом", async () => {
    const { devhubRouter } = await import("../src/routes/devhub.js");
    const a = express();
    a.use(express.json());
    a.use("/api/devhub", devhubRouter);

    const kody: number[] = [];
    for (let i = 0; i < 34; i++) {
      const r = await request(a).post("/api/devhub/media/gumroad-checkout").send({});
      kody.push(r.status);
    }
    expect(kody[0], "первый запрос не дошёл до обработчика").toBe(400);
    expect(kody.includes(429), "предела нет у кассы Gumroad").toBe(true);
  });
});
