/**
 * Публичная статистика PsyApp: без «среднего streak» и без проб в «комьюнити».
 * 20.10.2026: «118d средний streak» считался по всем аккаунтам (брошенные «растили» серию),
 * «24 в комьюнити» — вместе с пробами. Слово Оркестратора: streak снять, пробы исключить
 * тем же источником признаков, что /api/stats/users (нашВнутреннийАдрес + слова пробы).
 */
import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";

const ЛЮДИ = [
  { alias: "user-ab12", owner_email: null },
  { alias: "user-cd34", owner_email: "aliya@gmail.com" },
  { alias: "probe-apps-x", owner_email: null },
  { alias: "smoke_1", owner_email: null },
  { alias: "user-ef56", owner_email: "demo-bureau@aevion.app" },
  { alias: "user-gh78", owner_email: "buyer@example.test" },
];

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: vi.fn(async (sql: string) => {
      if (/FROM psyapp_users u/.test(sql)) return { rows: ЛЮДИ };
      if (/FROM psyapp_triggers/.test(sql) && /GROUP BY/.test(sql)) return { rows: [{ trigger_type: "craving", cnt: 3 }] };
      return { rows: [] };
    }),
  }),
}));
vi.mock("../src/lib/ensurePsyAppTables", () => ({
  ensurePsyAppTables: vi.fn(async () => {}),
  isPsyAppDbReady: () => true,
  getPsyAppDbError: () => null,
}));

const { psyappDepsRouter, пробаPsyApp } = await import("../src/routes/psyappDeps");

describe("PsyApp /stats", () => {
  it("в комьюнити — только люди: 2 из 6 (пробы по псевдониму и по нашей почте владельца исключены)", async () => {
    const a = express(); a.use("/api/psyapp-deps", psyappDepsRouter);
    const r = await request(a).get("/api/psyapp-deps/stats");
    expect(r.status).toBe(200);
    expect(r.body.total_users).toBe(2);
    expect(r.body).not.toHaveProperty("avg_streak_days");
    expect(r.body.top_trigger_type).toBe("craving");
  });
  it("признаки пробы", () => {
    expect(пробаPsyApp("probe-apps-1", null)).toBe(true);
    expect(пробаPsyApp("user-xx", "demo@aevion.app")).toBe(true);
    expect(пробаPsyApp("user-xx", "aliya@gmail.com")).toBe(false);
    expect(пробаPsyApp("problem-solver", null)).toBe(false);
  });
});
