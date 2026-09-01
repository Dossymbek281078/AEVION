import { describe, test, expect, vi } from "vitest";
import express from "express";
import request from "supertest";

/**
 * ОТКРЫТАЯ ручка, которая отправляет письма, обязана быть под пределом.
 *
 * Отдельный файл, потому что предел здесь БОЕВОЙ: соседний
 * devhubGuestLinkRouteContract поднимает его переменной, чтобы пять проверок
 * контракта не выбрали три попытки. Если бы ограничитель проверялся только
 * там, он не проверялся бы нигде — глушить защиту в тесте и не иметь второго
 * места, где она боевая, значит остаться без неё незаметно.
 *
 * Почему это важно именно для писем: квота у почтового провайдера суточная,
 * и открытая ручка без предела выжигает её за час — после чего письма не
 * уходят НИКОМУ, включая тех, кто заплатил.
 */

const { mockRequest } = vi.hoisted(() => ({ mockRequest: vi.fn() }));

vi.mock("../src/lib/devhubGuestLink", () => ({
  requestGuestLink: mockRequest,
  confirmGuestLink: vi.fn(),
  LINK_NEUTRAL: "нейтральный ответ",
}));
vi.mock("../src/lib/ensureDevHubTables", () => ({
  ensureDevHubTables: vi.fn().mockResolvedValue(undefined),
  isDevHubDbReady: () => true,
}));
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: vi.fn().mockResolvedValue({ rows: [] }) }),
  getPoolStats: () => null,
}));

describe("гостевая ссылка под пределом частоты", () => {
  test("четвёртая попытка подряд отбивается", async () => {
    const { devhubRouter } = await import("../src/routes/devhub.js");
    const a = express();
    a.use(express.json());
    a.use("/api/devhub", devhubRouter);
    mockRequest.mockResolvedValue("no_purchase");

    const kody: number[] = [];
    for (let i = 0; i < 4; i++) {
      const r = await request(a)
        .post("/api/devhub/guest/link-request")
        .send({ email: "kto" + i + "@example.com" });
      kody.push(r.status);
    }

    // Положительный контроль внутри той же проверки: первые попытки ДОЛЖНЫ
    // проходить. Без него тест был бы зелёным и на ручке, которая отбивает
    // всех подряд, — то есть на сломанной.
    expect(kody.slice(0, 3), "ограничитель бьёт по годным попыткам").toEqual([200, 200, 200]);
    expect(kody[3], "четвёртая попытка прошла — предела нет").toBe(429);
  });
});
