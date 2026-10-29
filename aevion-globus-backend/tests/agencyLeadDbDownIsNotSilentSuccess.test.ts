/**
 * Заявка агентства при отказе базы — не «успех».
 *
 * Свип 27.10.2026 (ответ POST при pool.query → ошибка, 99 ручек): /api/agency/lead отвечал
 * 201 { ok: true, stored: "memory" }. Поле честное, но витрина агентства его не читает, а
 * память процесса живёт до перезапуска. Пока письмо основателю уходит — заявка не потеряна.
 * Если же И база упала, И уведомление не ушло — заявка существует только в памяти, человек
 * видит «отправлено», и никто о ней не узнает. Для этого сочетания — 503 lead_not_stored.
 *
 * Проверяется ЗАПРОСОМ с подменённым пулом, не чтением исходника.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const { mockQuery, mockNotice, mockReceipt } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockNotice: vi.fn(),
  mockReceipt: vi.fn(),
}));

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: mockQuery }),
  getPoolStats: () => null,
}));
vi.mock("../src/lib/constitutionBrevo", () => ({
  sendAgencyLeadNotice: mockNotice,
  sendAgencyLeadReceipt: mockReceipt,
}));

process.env.DATABASE_URL = process.env.DATABASE_URL || "postgres://test:test@127.0.0.1:1/test";

async function приложение() {
  const { agencyLeadRouter } = await import("../src/routes/agencyLead");
  const a = express();
  a.use(express.json());
  a.use("/api/agency", agencyLeadRouter);
  return a;
}

const заявка = { contact: "lead-db-down@example.test", name: "Проверка", message: "Нужна защита бренда, напишите." };

describe("заявка агентства при отказе базы", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockNotice.mockReset();
    mockReceipt.mockReset().mockResolvedValue(false);
  });

  it("база упала И уведомление не ушло → 503 lead_not_stored, не «ok»", async () => {
    mockQuery.mockRejectedValue(new Error("db down"));
    mockNotice.mockResolvedValue(false);
    const r = await request(await приложение()).post("/api/agency/lead").send(заявка);
    expect(r.status).toBe(503);
    expect(r.body.ok).toBe(false);
    expect(r.body.error).toBe("lead_not_stored");
    expect(r.body.stored).toBe("memory");
    expect(r.body.notified).toBe(false);
  });

  it("КОНТРОЛЬ: база упала, но письмо ушло → 201 с честным stored=memory (заявка у основателя)", async () => {
    mockQuery.mockRejectedValue(new Error("db down"));
    mockNotice.mockResolvedValue(true);
    const r = await request(await приложение()).post("/api/agency/lead").send(заявка);
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ ok: true, stored: "memory", notified: true });
  });

  it("КОНТРОЛЬ: база жива, письмо не ушло → 201 stored=db (заявка в базе, сводка её покажет)", async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    mockNotice.mockResolvedValue(false);
    const r = await request(await приложение()).post("/api/agency/lead").send(заявка);
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ ok: true, stored: "db", notified: false });
  });
});
