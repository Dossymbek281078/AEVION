import { describe, test, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";

/**
 * Сводка расхода QReal: только числа, никогда — адреса.
 *
 * Данные о рендерах лежат в `QRealQuota`, и «сколько рендеров и в какие дни»
 * до 30.08.2026 нельзя было спросить ниоткуда. Для разговора о счёте
 * поставщика это ровно недостающее число: сумма в выписке есть, разбивки нет.
 *
 * 🔒 Главное здесь — приватность. В таблице лежит СЫРОЙ адрес клиента.
 * Читающая ручка над такой таблицей легко превращается в выгрузку адресов
 * посетителей, поэтому запрос берёт только строки итогов, а различные адреса
 * считает через COUNT(DISTINCT) — сами значения не выбираются. Тест проверяет
 * это ПО ОТВЕТУ, а не по тексту запроса: греп по SQL не заметил бы, если поле
 * просочится другим путём.
 *
 * И отдельно: при недоступной базе ответ обязан сказать «не знаю», а не отдать
 * нули. Ноль здесь читался бы как «расхода не было» — то есть ложь на денежном
 * вопросе.
 */

const { mockQuery, state } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  state: { fails: false },
}));
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: mockQuery }) }));

// eslint-disable-next-line import/first
import { qrealRouter } from "../src/routes/qreal";

const SECRET_IP = "203.0.113.77";

beforeEach(() => {
  state.fails = false;
  mockQuery.mockReset();
  mockQuery.mockImplementation(async (text: string) => {
    if (state.fails) throw new Error("connection terminated unexpectedly");
    if (/COUNT\(DISTINCT/i.test(text)) return { rows: [{ day: "2026-08-30", ips: 4 }], rowCount: 1 };
    if (/FROM "QRealQuota"/i.test(text)) {
      return {
        rows: [
          { day: "2026-08-30", ip: "__global__", count: 14 },
          { day: "2026-08-30", ip: "__global_judge__", count: 3 },
          // Если ручка когда-нибудь начнёт выбирать строки по адресам, она
          // получит вот эту — и тест поймает адрес в ответе.
          { day: "2026-08-30", ip: SECRET_IP, count: 9 },
        ],
        rowCount: 3,
      };
    }
    return { rows: [], rowCount: 0 };
  });
});

function app() {
  const a = express();
  a.use(express.json());
  a.use("/api/qreal", qrealRouter);
  return a;
}
function adminToken() {
  return jwt.sign({ sub: "admin-1", email: "a@e.com", role: "admin" },
    process.env.AUTH_JWT_SECRET || "dev-auth-secret", { algorithm: "HS256" });
}

describe("сводка расхода QReal", () => {
  test("без прав администратора не отдаётся", async () => {
    const r = await request(app()).get("/api/qreal/usage");
    expect(r.status, "деловая метрика ушла бы кому угодно").toBe(403);
  });

  test("администратору отдаёт числа и ПОТОЛКИ рядом", async () => {
    const r = await request(app()).get("/api/qreal/usage").set("Authorization", `Bearer ${adminToken()}`);
    expect(r.status, r.text.slice(0, 200)).toBe(200);
    expect(r.body.days?.[0]?.renders, "не доехало число рендеров").toBe(14);
    expect(r.body.days?.[0]?.judgements).toBe(3);
    // Без потолка число нечитаемо: 14 из 20 и 14 из 200 — разные новости.
    expect(r.body.caps?.renderGlobalDaily, "потолок не отдан — число нечитаемо").toBeGreaterThan(0);
  });

  test("🔒 в ответе НЕТ ни одного адреса, только их количество", async () => {
    const r = await request(app()).get("/api/qreal/usage").set("Authorization", `Bearer ${adminToken()}`);
    expect(
      JSON.stringify(r.body).includes(SECRET_IP),
      "адрес посетителя попал в ответ: читающая ручка стала выгрузкой адресов",
    ).toBe(false);
    expect(r.body.days?.[0]?.distinctAddresses, "число различных адресов не отдано").toBe(4);
  });

  test("при недоступной базе отвечает «не знаю», а не нулями", async () => {
    state.fails = true;
    const r = await request(app()).get("/api/qreal/usage").set("Authorization", `Bearer ${adminToken()}`);
    expect(r.status).toBe(503);
    expect(r.body.available, "нули читались бы как «расхода не было»").toBe(false);
  });
});
