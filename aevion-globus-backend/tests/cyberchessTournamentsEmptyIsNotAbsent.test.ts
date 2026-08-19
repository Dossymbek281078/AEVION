import { describe, test, expect, afterAll, vi } from "vitest";
import * as realFs from "node:fs";
import * as path from "node:path";
import express from "express";
import request from "supertest";

// Пустой список — это состояние, а не его отсутствие. 13.08.2026.
//
// Загрузка честно различала «файла нет» (tournaments: null) и «файл есть, а в
// нём пусто» (tournaments: []), но потребитель обе ситуации схлопывал в
// `loaded && loaded.length > 0` — и на пустом списке подставлял двенадцать
// посевных фикстур.
//
// Последствие ровно то, ради чего сегодня делалась админская ручка удаления:
// убираешь демо-турниры, список пустеет, всё выглядит сделанным — а при
// следующей выкатке они возвращаются. Уборка отменяет сама себя, и никто об
// этом не узнаёт, потому что отказа нет: в логе «фикстуры», в списке
// двенадцать турниров, ошибок ноль.

const { scratch } = vi.hoisted(() => {
  const fs = require("node:fs") as typeof import("node:fs");
  const os = require("node:os") as typeof import("node:os");
  const p = require("node:path") as typeof import("node:path");
  const dir = fs.mkdtempSync(p.join(os.tmpdir(), "cc-tour-empty-"));
  process.env.CYBERCHESS_TOURNAMENTS_DIR = dir;
  delete process.env.DATABASE_URL; // базы в этом тесте нет — проверяем файловый путь
  // Файл ЕСТЬ, и в нём пусто: так выглядит диск после того, как человек удалил
  // последний турнир админской ручкой.
  fs.writeFileSync(
    p.join(dir, "cyberchess-tournaments.json"),
    JSON.stringify({ savedAt: new Date().toISOString(), tournaments: [] }),
    "utf-8",
  );
  return { scratch: dir };
});

vi.mock("../src/routes/cyberchessMatchmaking", () => ({
  createPreMatchedMatch: vi.fn(),
  onMatchSettled: vi.fn(),
  ALLOWED_TIME_CONTROLS: ["60+0", "180+0", "300+5", "600+10", "1800+0"],
}));

import tournamentsRouter from "../src/routes/cyberchessTournaments";

const app = express();
app.use(express.json());
app.use("/api/cyberchess-tournaments", tournamentsRouter);

afterAll(() => {
  delete process.env.CYBERCHESS_TOURNAMENTS_DIR;
  try {
    realFs.rmSync(scratch, { recursive: true, force: true });
  } catch {
    /* временный каталог */
  }
});

describe("пустой сохранённый список не подменяется фикстурами", () => {
  test("список остаётся пустым, а не наполняется двенадцатью демо-турнирами", async () => {
    const res = await request(app).get("/api/cyberchess-tournaments/list");

    expect(res.status).toBe(200);
    expect(res.body.tournaments).toEqual([]);
  });

  test("а когда файла НЕТ вовсе — фикстуры на месте", async () => {
    // Обратная сторона правки. Различие «пусто» и «нет» имеет смысл, только
    // если работают обе ветки: иначе, чиня возврат демо-турниров, легко тихо
    // выключить первый показ на чистой установке — и это никто не заметит,
    // потому что пустой список выглядит как «просто ещё ничего не создали».
    vi.resetModules();
    const os = await import("node:os");
    const freshDir = realFs.mkdtempSync(path.join(os.tmpdir(), "cc-tour-fresh-"));
    const prevDir = process.env.CYBERCHESS_TOURNAMENTS_DIR;
    process.env.CYBERCHESS_TOURNAMENTS_DIR = freshDir;
    try {
      const fresh = (await import("../src/routes/cyberchessTournaments")).default;
      const freshApp = express();
      freshApp.use(express.json());
      freshApp.use("/api/cyberchess-tournaments", fresh);

      const res = await request(freshApp).get("/api/cyberchess-tournaments/list");
      expect(res.status).toBe(200);
      expect((res.body.tournaments as unknown[]).length).toBeGreaterThan(0);
    } finally {
      process.env.CYBERCHESS_TOURNAMENTS_DIR = prevDir;
      realFs.rmSync(freshDir, { recursive: true, force: true });
    }
  });

  test("файл на диске не переписан фикстурами", () => {
    // Отдельная проверка, потому что подстановка не только показывает лишнее —
    // она тут же СОХРАНЯЕТ его на диск (tryWriteToDisk после buildSeedFixtures).
    // То есть удалённое возвращается насовсем, а не до перезапуска.
    const onDisk = JSON.parse(
      realFs.readFileSync(path.join(scratch, "cyberchess-tournaments.json"), "utf-8"),
    ) as { tournaments: unknown[] };

    expect(onDisk.tournaments).toEqual([]);
  });
});
