import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

/*
 * 🔴 142 (18.10.2026): разборы задач (ru/en/kk) живут в таблице PuzzleRazbor и отдаются полем razbor у
 * GET /api/cyberchess-puzzles/:id; импорт — только админу, пачками до 2000, upsert. Сторож ДЕЛАЕТ ЗАПРОС к ручке
 * и смотрит тело: (1) задача с разбором → поле есть; (2) без разбора → поля НЕТ (не null, не пусто);
 * (3) отказ БД не ломает ответ о задаче; (4) импорт без админа 403, с мусором 400, нормальный — written/total;
 * (5) SQL записи — один INSERT … ON CONFLICT с 5 параметрами на строку.
 */
process.env.DATABASE_URL = "postgres://test/test";
process.env.CYBERCHESS_DB_INIT_RETRY_MS = "50";
const { бд } = vi.hoisted(() => ({ бд: { rows: new Map<string, { ru: string; en: string; kk: string; model: string }>(), падать: false, запросы: [] as Array<{ text: string; params: unknown[] }> } }));
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: async (text: string, params: unknown[] = []) => {
      бд.запросы.push({ text, params });
      if (бд.падать) throw new Error("нет базы");
      if (/CREATE TABLE/.test(text)) return { rows: [], rowCount: 0 };
      if (/^SELECT "ru"/.test(text)) { const r = бд.rows.get(String(params[0])); return { rows: r ? [r] : [], rowCount: r ? 1 : 0 }; }
      if (/^SELECT count/.test(text)) return { rows: [{ n: String(бд.rows.size) }], rowCount: 1 };
      if (/^INSERT INTO "PuzzleRazbor"/.test(text)) { for (let i = 0; i < params.length; i += 5) бд.rows.set(String(params[i]), { ru: String(params[i + 1]), en: String(params[i + 2]), kk: String(params[i + 3]), model: String(params[i + 4]) }); return { rows: [], rowCount: params.length / 5 }; }
      if (/count\(\*\)/i.test(text) && /"ChessPuzzle"/.test(text)) return { rows: [{ n: "2", count: "2", total: "2" }], rowCount: 1 };
      if (/FROM "ChessPuzzle"/.test(text)) return { rows: [{ id: "li_075iw", fen: "5r1k/p5pp/2p1Q3/1pq1p3/4P3/8/B4PPP/5RK1 w - - 0 32", sol: JSON.stringify(["f1d1", "c5f2", "g1h1", "f2f1", "d1f1", "f8f1"]), name: "Мат в 3 · Лёгкая", rating: 1186, theme: "Мат на последней горизонтали", phase: "Endgame", side: "w", goal: "Mate", mateIn: 3 }, { id: "li_bezrazbora", fen: "8/8/8/8/8/8/8/K6k w - - 0 1", sol: JSON.stringify(["a1a2", "h1h2"]), name: "x", rating: 900, theme: "т", phase: "Endgame", side: "w", goal: "Best move", mateIn: null }], rowCount: 2 };
      if (/count\(\*\)/i.test(text)) return { rows: [{ n: "2", count: "2" }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    },
  }),
  getPoolStats: () => null,
}));
vi.mock("../src/lib/adminAuth", () => ({ isAdminRequest: (req: { headers: Record<string, unknown> }) => req.headers["x-admin-token"] === "secret-test" }));
vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => vi.fn() }));

async function приложение() {
  const { default: router } = await import("../src/routes/cyberchessPuzzles");
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  app.use("/api/cyberchess-puzzles", router);
  return app;
}
beforeEach(async () => { бд.rows.clear(); бд.падать = false; бд.запросы.length = 0; (await import("../src/lib/puzzleRazbor"))._sbrosDlyaTestov(); });

describe("разбор задачи: выдача и импорт (142)", () => {
  it("🔴 импорт админом → written/total; затем GET /:id отдаёт razbor, а задача без разбора — без поля", async () => {
    const app = await приложение();
    const имп = await request(app).post("/api/cyberchess-puzzles/razbory/import").set("X-Admin-Token", "secret-test")
      .send({ items: [{ id: "li_075iw", ru: "Rd1 … мат", en: "Rd1 … mate", kk: "Rd1 … мат", model: "claude-sonnet-5-5" }] });
    expect(имп.status, JSON.stringify(имп.body)).toBe(200);
    expect(имп.body).toMatchObject({ ok: true, written: 1, total: 1 });
    const ins = бд.запросы.find((q) => /^INSERT INTO "PuzzleRazbor"/.test(q.text));
    expect(ins, "нет INSERT").toBeTruthy();
    expect(ins!.text).toContain('ON CONFLICT ("puzzleId") DO UPDATE');
    expect(ins!.params).toHaveLength(5);

    const с = await request(app).get("/api/cyberchess-puzzles/li_075iw");
    expect(с.status).toBe(200);
    expect(с.body.razbor).toEqual({ ru: "Rd1 … мат", en: "Rd1 … mate", kk: "Rd1 … мат", model: "claude-sonnet-5-5" });
    const без = await request(app).get("/api/cyberchess-puzzles/li_bezrazbora");
    expect(без.status).toBe(200);
    expect(без.body.puzzle.id).toBe("li_bezrazbora");
    expect("razbor" in без.body, "у задачи без разбора поля быть не должно").toBe(false);
  });

  it("🔴 отказ БД при поиске разбора не ломает ответ о задаче", async () => {
    const app = await приложение();
    await request(app).get("/api/cyberchess-puzzles/li_075iw"); // банк загружен
    бд.падать = true;
    const r = await request(app).get("/api/cyberchess-puzzles/li_075iw");
    expect(r.status).toBe(200);
    expect(r.body.puzzle.id).toBe("li_075iw");
    expect("razbor" in r.body).toBe(false);
  });

  it("импорт: без админа 403; пустой список и мусорный id — 400; больше 2000 — 400", async () => {
    const app = await приложение();
    expect((await request(app).post("/api/cyberchess-puzzles/razbory/import").send({ items: [{ id: "a", ru: "1", en: "1", kk: "1" }] })).status).toBe(403);
    const adm = () => request(app).post("/api/cyberchess-puzzles/razbory/import").set("X-Admin-Token", "secret-test");
    expect((await adm().send({ items: [] })).status).toBe(400);
    expect((await adm().send({ items: [{ id: "../x", ru: "1", en: "1", kk: "1" }] })).status).toBe(400);
    expect((await adm().send({ items: [{ id: "li_1", ru: "", en: "1", kk: "1" }] })).status).toBe(400);
    expect((await adm().send({ items: Array.from({ length: 2001 }, (_, i) => ({ id: "li_" + i, ru: "1", en: "1", kk: "1" })) })).status).toBe(400);
    expect(бд.запросы.some((q) => /^INSERT/.test(q.text)), "мусор не должен дойти до INSERT").toBe(false);
  });
});
