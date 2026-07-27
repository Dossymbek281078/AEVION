import { describe, test, expect, beforeAll } from "vitest";
import request from "supertest";
import express from "express";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * `/meta` печатал `source: POOL_PATH || POOL_URL` — то есть НАСТРОЙКУ, а не то,
 * откуда пул взят на самом деле. На проде это давало противоречивый ответ:
 * `poolSize: 500000` рядом с `source` = публичный puzzles.json, в котором
 * 10 818 записей. На таком ответе легко сделать неверный вывод в любую сторону
 * («врёт счётчик» / «врёт файл»), хотя врал именно ярлык источника — я на этом
 * 27.07.2026 чуть не отозвал верную правку.
 *
 * Тест бьёт по маршруту и проверяет СВЯЗЬ: сколько записей реально загружено и
 * откуда — должны говорить об одном и том же источнике.
 */

const PUZZLES = [
  { fen: "8/8/8/8/8/8/8/K6k w - - 0 1", sol: ["a1b1"], name: "Тест 1", r: 1000, theme: "Тактика" },
  { fen: "8/8/8/8/8/8/8/K6k b - - 0 1", sol: ["h1g1"], name: "Тест 2", r: 1100, theme: "Тактика" },
];

let app: express.Express;
let poolPath: string;

beforeAll(async () => {
  const dir = mkdtempSync(join(tmpdir(), "cc-puzzles-"));
  poolPath = join(dir, "pool.json");
  writeFileSync(poolPath, JSON.stringify(PUZZLES), "utf8");

  // env ДО импорта модуля: путь читается на верхнем уровне, и при обычном
  // импорте наверху файла присваивание опоздало бы — этот класс ошибок в
  // репозитории уже ловили.
  process.env.CYBERCHESS_PUZZLES_PATH = poolPath;
  delete process.env.DATABASE_URL;

  const mod = await import("../src/routes/cyberchessPuzzles");
  app = express();
  app.use(express.json());
  app.use("/api/cyberchess-puzzles", mod.default ?? (mod as { router?: express.Router }).router!);
});

describe("cyberchess /meta: источник должен совпадать с тем, что загружено", () => {
  test("называет фактический источник, а не настроенный запасной URL", async () => {
    const res = await request(app).get("/api/cyberchess-puzzles/meta");
    expect(res.status).toBe(200);
    expect(res.body.poolSize).toBe(PUZZLES.length);
    // Ключевая проверка — РАЗЛИЧАЮЩАЯ. Просто «источник содержит путь» ничего не
    // доказывало бы: в этой раскладке настроенный путь совпадает с фактическим,
    // и старый код (печатавший саму настройку) прошёл бы тест. Поэтому требуем
    // ярлык, который ставит только загрузчик по факту загрузки: `file <путь>`.
    expect(String(res.body.source)).toMatch(/^file /);
    expect(String(res.body.source)).toContain(poolPath);
  });

  test("размер пула и число тем берутся из того же загруженного набора", async () => {
    const res = await request(app).get("/api/cyberchess-puzzles/meta");
    expect(res.body.themes).toBe(1); // обе задачи с темой «Тактика»
    expect(res.body.poolSize).toBe(2);
  });
});
