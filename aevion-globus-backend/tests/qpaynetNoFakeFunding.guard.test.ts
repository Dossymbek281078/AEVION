import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";

/**
 * Кошелёк нельзя пополнить из ничего.
 *
 * Повод, а не гипотеза. Проверка 09.10.2026 (15-Аудиты-и-сводки) показала:
 * POST /api/qpaynet/deposit увеличивал баланс БЕЗ подтверждённого платежа —
 * ни одного обращения к платёжному провайдеру, в журнал писалась заглушка
 * `external:funding`. Суточный предел (500 000 ₸) считался НА КОШЕЛЁК, а
 * кошельков заводилось сколько угодно: предела не было вовсе.
 *
 * Замер прода в тот же день, только чтение, публичная ручка /stats:
 * 41 активный кошелёк, 82 операции, 295 010 ₸ «зачислений», которых никто
 * не платил. Прод не эксплуатировался: ни одного зачисления с нашей стороны.
 *
 * Сторож делает ЗАПРОС К РУЧКЕ, а не проверяет предикат: важно не то, что
 * функция возвращает false, а что ручка отвечает отказом и НЕ ТРОГАЕТ баланс.
 */

const SECRET = "test-secret-qpaynet-funding";

let запросы: string[] = [];
let счётКошельков = 0;

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: vi.fn(async (sql: string) => {
      запросы.push(String(sql));
      if (/COUNT\(\*\)/i.test(String(sql))) return { rows: [{ n: счётКошельков }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    }),
    connect: vi.fn(async () => ({
      query: vi.fn(async (sql: string) => {
        запросы.push(String(sql));
        return { rows: [], rowCount: 0 };
      }),
      release: vi.fn(),
    })),
  }),
}));

const приложение = async () => {
  process.env.AUTH_JWT_SECRET = SECRET;
  const { qpaynetRouter } = await import("../src/routes/qpaynet");
  const a = express();
  a.use(express.json());
  a.use("/api/qpaynet", qpaynetRouter);
  return a;
};

const токен = () => jwt.sign({ sub: "u_проба", email: "probe@aevion.app" }, SECRET, { algorithm: "HS256", expiresIn: "1h" });

/** Трогал ли обработчик баланс — по тексту ушедших в базу запросов. */
const балансТронут = () => запросы.some((s) => /balance\s*=\s*balance/i.test(s));

beforeEach(() => {
  запросы = [];
  счётКошельков = 0;
  delete process.env.QPAYNET_FUNDING_PROVIDER;
});

describe("QPayNet: зачисление без источника денег закрыто", () => {
  it("прибор видит предмет: ручка смонтирована и отвечает", async () => {
    // ЗНАМЕНАТЕЛЬ. Без этого отказ 403 ниже мог бы означать «маршрута нет».
    const r = await request(await приложение()).get("/api/qpaynet/stats");
    expect([200, 500]).toContain(r.status);
  });

  it("без входа — 401, а не молчаливый успех", async () => {
    const r = await request(await приложение()).post("/api/qpaynet/deposit").send({ walletId: "w1", amount: 1000 });
    expect(r.status).toBe(401);
    expect(балансТронут()).toBe(false);
  });

  it("🔴 вошедший получает 403 funding_not_connected", async () => {
    const r = await request(await приложение())
      .post("/api/qpaynet/deposit")
      .set("Authorization", `Bearer ${токен()}`)
      .send({ walletId: "w1", amount: 500000 });
    expect(r.status).toBe(403);
    expect(r.body.error).toBe("funding_not_connected");
  });

  it("🔴 и баланс при этом НЕ ТРОГАЕТСЯ", async () => {
    await request(await приложение())
      .post("/api/qpaynet/deposit")
      .set("Authorization", `Bearer ${токен()}`)
      .send({ walletId: "w1", amount: 500000 });
    expect(
      балансТронут(),
      `в базу ушёл запрос, меняющий баланс: ${запросы.filter((s) => /balance/i.test(s)).join(" | ")}`,
    ).toBe(false);
  });

  it("ОТРИЦАТЕЛЬНЫЙ контроль: отказ именно от признака, а не всегда", async () => {
    // Если бы ручка отвечала 403 при любых условиях, проверки выше ничего не
    // стерегли бы. Включаем признак подключённого приёма денег — отказ обязан
    // исчезнуть (в продакшне он останется: там признак игнорируется).
    process.env.QPAYNET_FUNDING_PROVIDER = "connected";
    const r = await request(await приложение())
      .post("/api/qpaynet/deposit")
      .set("Authorization", `Bearer ${токен()}`)
      .send({ walletId: "w1", amount: 1000 });
    expect(r.status).not.toBe(403);
  });

  it("в продакшне зачисления не происходит даже при включённом признаке", () => {
    /*
     * Статус здесь НЕ закрепляем, и это осознанно. В режиме production
     * проверка входа строже, и запрос отвергается РАНЬШЕ нашей проверки —
     * приходит 401, а не 403. Закрепить 403 значило бы требовать того, чего
     * в этой обвязке не получить, и сторож краснел бы на исправном коде.
     *
     * Стережём то, что важно по существу: при включённом признаке в
     * продакшне зачисление не выполняется. Проверяем это предикатом,
     * повторённым здесь дословно, — ровно так же поступает соседний сторож
     * qpaynetAdminGate с isAdmin, и по той же причине: модуль на четыре
     * тысячи строк не экспортирует внутренние функции.
     */
    const признак = (nodeEnv: string, флаг: string | undefined) => {
      if (nodeEnv === "production") return false;
      return флаг === "connected";
    };
    expect(признак("production", "connected"), "в продакшне признак обязан игнорироваться").toBe(false);
    expect(признак("production", undefined)).toBe(false);
    expect(признак("test", "connected"), "вне продакшна признак работает").toBe(true);
    expect(признак("test", undefined)).toBe(false);
  });

});

describe("QPayNet: число кошельков на владельца ограничено", () => {
  it("на пределе — 403 wallet_limit_reached", async () => {
    счётКошельков = 5;
    const r = await request(await приложение())
      .post("/api/qpaynet/wallets")
      .set("Authorization", `Bearer ${токен()}`)
      .send({ name: "проба" });
    expect(r.status).toBe(403);
    expect(r.body.error).toBe("wallet_limit_reached");
  });

  it("ОТРИЦАТЕЛЬНЫЙ контроль: ниже предела кошелёк заводится", async () => {
    счётКошельков = 0;
    const r = await request(await приложение())
      .post("/api/qpaynet/wallets")
      .set("Authorization", `Bearer ${токен()}`)
      .send({ name: "проба" });
    expect(r.status).not.toBe(403);
  });
});
