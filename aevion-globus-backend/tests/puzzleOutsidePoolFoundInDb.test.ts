/**
 * 28.10.2026 (окно «Продукт»). Пул задач = SELECT … LIMIT 500 000 из 502 584 БЕЗ ORDER BY:
 * какие 2 584 задачи останутся за бортом, решает порядок строк в Postgres, и он
 * меняется между перезапусками. li_4YRGx из описания опубликованного ролика
 * ezB60KTGlTU (20.10) после выкатки 24.10 отвечала 404 not_found [Точно curl 28.10:
 * poolSize 500000, bankTotal 502584, capped true]. Правило: промах в пуле → запрос
 * в базу по первичному ключу; есть строка — задача отдаётся и подшивается в пул.
 * Мутация 28.10: убрать вызов найтиВБазе → тест 1 красный (проверено).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express from "express";
import request from "supertest";

const каталог = mkdtempSync(join(tmpdir(), "aevion-puzzle-db-"));
const файлПула = join(каталог, "pool.json");
const В_ПУЛЕ = { id: "li_382iH", fen: "r4rr1k/ppp2ppp/2nq4/8/4P1n1/2NP4/PPP1N1PP/R3QRK1 b - - 6 13", sol: ["d6h2"], name: "Мат в 1 · Лёгкая", r: 696, theme: "Мат в 1", side: "b", goal: "Mate", mateIn: 1 };
// Строка таблицы, которой в пуле нет (за бортом LIMIT): так выглядит li_4YRGx на проде.
const ЗА_БОРТОМ = { id: "li_4YRGx", fen: "6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1", sol: JSON.stringify(["d1d8"]), name: "Мат в 1 · Лёгкая", rating: 700, theme: "Мат в 1", phase: "Endgame", side: "w", goal: "Mate", mateIn: 1 };
const запросыПоId: string[] = [];

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: async (sql: string, params?: unknown[]) => {
      if (/WHERE "id" = \$1/.test(sql)) {
        запросыПоId.push(String(params?.[0]));
        return { rows: params?.[0] === "li_4YRGx" ? [ЗА_БОРТОМ] : [] };
      }
      if (/COUNT\(\*\)/.test(sql)) return { rows: [{ n: "2" }] };
      return { rows: [] };
    },
  }),
}));

beforeAll(() => writeFileSync(файлПула, JSON.stringify([В_ПУЛЕ]), "utf8"));
afterAll(() => rmSync(каталог, { recursive: true, force: true }));

async function приложение() {
  process.env.CYBERCHESS_PUZZLES_PATH = файлПула; // пул из файла: 1 задача
  process.env.DATABASE_URL = "postgres://test/test"; // база «есть» — отвечает мок выше
  vi.resetModules();
  const { default: router } = await import("../src/routes/cyberchessPuzzles");
  const app = express();
  app.use(express.json());
  app.use("/api/cyberchess-puzzles", router);
  return app;
}

describe("задача за бортом пула находится в базе по id", () => {
  it("🔴 li_4YRGx нет в пуле (1 задача), но она есть в таблице → 200 и та самая задача", async () => {
    const app = await приложение();
    const r = await request(app).get("/api/cyberchess-puzzles/li_4YRGx");
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(r.body.puzzle.id).toBe("li_4YRGx");
    expect(r.body.puzzle.fen).toBe(ЗА_БОРТОМ.fen);
    expect(r.body.puzzle.sol).toEqual(["d1d8"]); // sol из JSON-строки таблицы — массив
    expect(r.body.puzzle.r).toBe(700); // rating → r, как в ветке загрузки пула
  });

  it("второй запрос того же id — из пула, базу не дёргаем", async () => {
    const app = await приложение();
    запросыПоId.length = 0;
    await request(app).get("/api/cyberchess-puzzles/li_4YRGx");
    await request(app).get("/api/cyberchess-puzzles/li_4YRGx");
    expect(запросыПоId.filter((x) => x === "li_4YRGx")).toHaveLength(1);
  });

  it("контроль: id, которого нет и в таблице → 404 not_found с dbChecked:true", async () => {
    const app = await приложение();
    const r = await request(app).get("/api/cyberchess-puzzles/li_nope1");
    expect(r.status).toBe(404);
    expect(r.body.reason).toBe("not_found");
    expect(r.body.dbChecked).toBe(true);
  });

  it("контроль: задача из пула отвечает без обращения к базе", async () => {
    const app = await приложение();
    запросыПоId.length = 0;
    const r = await request(app).get("/api/cyberchess-puzzles/li_382iH");
    expect(r.status).toBe(200);
    expect(r.body.puzzle.id).toBe("li_382iH");
    expect(запросыПоId).toHaveLength(0);
  });
});
