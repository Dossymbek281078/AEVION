import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";

/**
 * Разбор зачислений QPayNet — ТОЛЬКО ЧТЕНИЕ, за админ-авторизацией.
 *
 * Повод. 09.10.2026 закрыт второй путь зачисления (POST /deposit поднимал
 * баланс без подтверждённой оплаты). Начисленное осталось: на проде 295 010 ₸
 * «зачислений» в 82 операциях. Какая часть из них настоящая — ни /stats, ни
 * /admin/reconcile не отвечают: первая даёт одну общую сумму, вторая кладёт
 * все зачисления в одну строку.
 *
 * Что именно охраняет этот сторож:
 * 1. ручка закрыта (без токена 401, не админ 403) — иначе разбор денег виден
 *    любому;
 * 2. ручка НИЧЕГО НЕ МЕНЯЕТ (ни UPDATE, ни INSERT, ни DELETE);
 * 3. 🔴 признак «настоящего» — ОПЛАЧЕННАЯ СЕССИЯ, а не описание операции.
 *    Описание задаёт сам отправитель запроса, поэтому отчёт по описанию
 *    подделывается одной строкой текста;
 * 4. контроль прибора: половины обязаны сойтись в общую сумму, и при
 *    несходящихся данных признак обязан стать false, а не промолчать.
 *
 * Сторож делает ЗАПРОС К РУЧКЕ (§0-СТОРОЖ-ДЕЛАЕТ-ЗАПРОС), а не проверяет
 * функцию: проверяется тело ответа и то, что ушло в базу.
 */

const SECRET = "test-secret-qpaynet-audit";

/** Числа подобраны под замер прода 09.10: всего 295 010 ₸ в 82 операциях. */
let данные = {
  paid_count: "2",
  paid_tiin: "120000",
  no_session_count: "80",
  no_session_tiin: "29381000",
  all_count: "82",
  all_tiin: "29501000",
};
let строкиПоКошелькам: Array<Record<string, unknown>> = [];
let запросы: string[] = [];

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: vi.fn(async (sql: string) => {
      const s = String(sql);
      запросы.push(s);
      if (s.includes("paid_count")) return { rows: [данные], rowCount: 1 };
      if (s.includes("GROUP BY w.owner_id")) return { rows: строкиПоКошелькам, rowCount: строкиПоКошелькам.length };
      return { rows: [], rowCount: 0 };
    }),
    connect: vi.fn(async () => ({
      query: vi.fn(async (sql: string) => { запросы.push(String(sql)); return { rows: [], rowCount: 0 }; }),
      release: vi.fn(),
    })),
  }),
}));

const приложение = async () => {
  process.env.AUTH_JWT_SECRET = SECRET;
  process.env.QPAYNET_ADMIN_EMAILS = "boss@aevion.app";
  const { qpaynetRouter } = await import("../src/routes/qpaynet");
  const a = express();
  a.use(express.json());
  a.use("/api/qpaynet", qpaynetRouter);
  return a;
};

const токен = (email: string) =>
  jwt.sign({ sub: "u_проба", email }, SECRET, { algorithm: "HS256", expiresIn: "1h" });

const ПУТЬ = "/api/qpaynet/admin/deposits/audit";

beforeEach(() => {
  запросы = [];
  данные = {
    paid_count: "2",
    paid_tiin: "120000",
    no_session_count: "80",
    no_session_tiin: "29381000",
    all_count: "82",
    all_tiin: "29501000",
  };
  строкиПоКошелькам = [
    { owner_id: "u_1", wallet_id: "w_1", ops: 50, tiin: "20000000", first_at: "2026-09-01", last_at: "2026-10-08" },
    { owner_id: "u_2", wallet_id: "w_2", ops: 30, tiin: "9381000", first_at: "2026-09-15", last_at: "2026-10-09" },
  ];
});

describe("QPayNet: разбор зачислений закрыт админ-авторизацией", () => {
  it("без токена — 401", async () => {
    const r = await request(await приложение()).get(ПУТЬ);
    expect(r.status).toBe(401);
    expect(r.body.error).toBe("auth_required");
  });

  it("вошедший, но не админ — 403", async () => {
    const r = await request(await приложение()).get(ПУТЬ).set("Authorization", "Bearer " + токен("someone@aevion.app"));
    expect(r.status).toBe(403);
    expect(r.body.error).toBe("not_admin");
  });

  it("ОТРИЦАТЕЛЬНЫЙ контроль: админ из QPAYNET_ADMIN_EMAILS получает 200", async () => {
    const r = await request(await приложение()).get(ПУТЬ).set("Authorization", "Bearer " + токен("boss@aevion.app"));
    expect(r.status).toBe(200);
  });
});

describe("QPayNet: разбор зачислений считает верно и ничего не меняет", () => {
  const какАдмин = async () =>
    request(await приложение()).get(ПУТЬ).set("Authorization", "Bearer " + токен("boss@aevion.app"));

  it("суммы сходятся: 1200 + 293810 = 295010 ₸", async () => {
    const r = await какАдмин();
    expect(r.status).toBe(200);
    expect(r.body.оплаченныеЧерезПровайдера.суммаKzt).toBe(1200);
    expect(r.body.оплаченныеЧерезПровайдера.операций).toBe(2);
    expect(r.body.безПодтверждённойОплаты.суммаKzt).toBe(293810);
    expect(r.body.безПодтверждённойОплаты.операций).toBe(80);
    expect(r.body.контроль.всегоЗачисленийKzt).toBe(295010);
    expect(r.body.контроль.операций).toBe(82);
    expect(r.body.контроль.половиныСходятся).toBe(true);
  });

  it("КОНТРОЛЬ ПРИБОРА: при несходящихся данных признак становится false", async () => {
    данные = { ...данные, all_tiin: "30000000" };
    const r = await какАдмин();
    expect(r.status).toBe(200);
    expect(r.body.контроль.половиныСходятся).toBe(false);
  });

  it("разбивка по кошелькам даёт ту же половину (знаменатель)", async () => {
    const r = await какАдмин();
    const строки = r.body.безПодтверждённойОплатыПоКошелькам;
    expect(строки.length).toBe(2);
    const сумма = строки.reduce((a: number, x: { суммаKzt: number }) => a + x.суммаKzt, 0);
    expect(Math.round(сумма * 100) / 100).toBe(293810);
    expect(строки[0].владелец).toBe("u_1");
    expect(строки[0].кошелёк).toBe("w_1");
  });

  it("признак настоящего — ОПЛАЧЕННАЯ СЕССИЯ, а не описание операции", async () => {
    await какАдмин();
    const свои = запросы.filter((s) => s.includes("qpaynet_transactions"));
    expect(свои.length).toBeGreaterThan(0);
    for (const s of свои) {
      expect(s.includes("qpaynet_deposit_checkouts")).toBe(true);
      expect(s.includes("c.tx_id = t.id")).toBe(true);
      expect(s.includes("c.status = " + "'paid'")).toBe(true);
      // по описанию судить нельзя: его пишет сам отправитель запроса
      expect(s.toLowerCase().includes("description")).toBe(false);
    }
  });

  it("ручка ничего не меняет: ни UPDATE, ни INSERT, ни DELETE", async () => {
    await какАдмин();
    expect(запросы.length).toBeGreaterThan(0);
    const меняющие = запросы.filter((s) => {
      const u = s.toUpperCase();
      return u.includes("UPDATE ") || u.includes("INSERT INTO") || u.includes("DELETE FROM");
    });
    expect(меняющие).toEqual([]);
  });
});
