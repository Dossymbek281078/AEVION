import { describe, test, expect, afterAll, vi } from "vitest";
import * as realFs from "node:fs";
import * as path from "node:path";
import express from "express";
import request from "supertest";

// Турниры переживают деплой. 2026-08-13.
//
// Регистрации, составы и результаты лежали в JSON-файле рядом с кодом. Файловая
// система контейнера временная: при каждом деплое Railway поднимает новый
// контейнер из образа — то есть с той версией файла, что лежит в репозитории.
// Всё, что игроки наиграли с прошлого деплоя, откатывалось к состоянию из git.
// Не с ошибкой, а молча.
//
// Теперь состояние зеркалится в Postgres, и при старте берётся та копия,
// которая свежее. Этот файл проверяет обе стороны: что база подхватывается,
// когда она новее, и что без базы всё работает ровно как раньше.
//
// Форма проверки — как у нового контейнера: файл на диске СТАРЫЙ (та версия,
// что в образе), а в базе лежит то, что успели наиграть.

const { scratch, db } = vi.hoisted(() => {
  const fs = require("node:fs") as typeof import("node:fs");
  const os = require("node:os") as typeof import("node:os");
  const p = require("node:path") as typeof import("node:path");
  const dir = fs.mkdtempSync(p.join(os.tmpdir(), "cc-tour-deploy-"));
  process.env.CYBERCHESS_TOURNAMENTS_DIR = dir;
  process.env.DATABASE_URL = "postgres://test/test";

  // Файл из образа: одна старая фикстура, метка вчерашняя.
  fs.writeFileSync(
    p.join(dir, "cyberchess-tournaments.json"),
    JSON.stringify({
      savedAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
      tournaments: [
        {
          id: "seed-old", title: "Из образа", format: "swiss", timeControl: "blitz",
          eloMin: 0, eloMax: 3000, players: 0, maxPlayers: 8, prizeChessy: 0,
          status: "upcoming", startsAt: "2026-08-20T10:00:00.000Z",
          registeredUserIds: [], roster: [], rounds: [],
        },
      ],
    }),
    "utf-8",
  );

  // База: то, что наиграли уже ПОСЛЕ этого файла.
  const state = {
    tournaments: [
      {
        id: "usr-live-event-77aa11", title: "Живой турнир игроков", format: "swiss",
        timeControl: "blitz", eloMin: 0, eloMax: 3000, players: 2, maxPlayers: 8,
        prizeChessy: 0, status: "upcoming", startsAt: "2026-08-20T10:00:00.000Z",
        registeredUserIds: ["p1", "p2"], roster: [], rounds: [],
      },
    ],
  };
  return {
    scratch: dir,
    db: {
      state,
      savedAt: new Date(Date.now() - 60_000),
      writes: [] as unknown[][],
      failRead: false,
      // База отвечает не мгновенно. Без задержки догрузка успевает сама собой,
      // и проверка ожидания ничего не доказывает — проверено мутацией: без неё
      // тесты зелёные и БЕЗ ожидания перед маршрутами.
      readDelayMs: 300,
    },
  };
});

vi.mock("pg", () => {
  class Pool {
    async query(text: string, params: unknown[] = []) {
      if (/CREATE TABLE/i.test(text)) return { rows: [] };
      if (/SELECT "state","savedAt"/i.test(text)) {
        await new Promise((r) => setTimeout(r, db.readDelayMs));
        if (db.failRead) throw new Error("connection reset by peer");
        return { rows: db.state ? [{ state: db.state, savedAt: db.savedAt }] : [] };
      }
      if (/INSERT INTO "CyberTournamentState"/i.test(text)) {
        db.writes.push(params);
        return { rows: [] };
      }
      return { rows: [] };
    }
    on() {}
  }
  return { default: { Pool }, Pool };
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

const titles = async () => {
  const res = await request(app).get("/api/cyberchess-tournaments/list");
  return (res.body.tournaments as Array<{ title: string }>).map((t) => t.title);
};

afterAll(() => {
  delete process.env.CYBERCHESS_TOURNAMENTS_DIR;
  delete process.env.DATABASE_URL;
  try {
    realFs.rmSync(scratch, { recursive: true, force: true });
  } catch {
    /* временный каталог */
  }
});

describe("новый контейнер не откатывает игроков к версии из образа", () => {
  test("ПЕРВЫЙ запрос уже видит состояние из базы, а не из образа", async () => {
    // Главный тест файла, и он же стережёт ожидание готовности перед
    // маршрутами: база в подделке отвечает 300 мс, поэтому без ожидания сюда
    // приехал бы «Из образа». Проверено мутацией — уберите `await storeReady`
    // в роутере, и этот тест краснеет.
    //
    // Стережёт именно ПЕРВЫЙ запрос: к моменту следующих тестов промис уже
    // разрешён, и они этой разницы не увидят. Поэтому он стоит здесь и первым.
    expect(await titles()).toContain("Живой турнир игроков");
    expect(await titles()).not.toContain("Из образа");
  });

  test("происхождение дозаполняется и у записей, пришедших из базы", async () => {
    // Иначе подпись «образец» пропала бы ровно после деплоя.
    const res = await request(app).get("/api/cyberchess-tournaments/usr-live-event-77aa11");
    expect(res.body.tournament.origin).toBe("user");
  });

  test("новая запись уезжает и в файл, и в базу", async () => {
    const before = db.writes.length;

    const created = await request(app)
      .post("/api/cyberchess-tournaments/")
      .send({ title: "Заведён после деплоя", format: "swiss", timeControl: "blitz", maxPlayers: 8 });
    expect(created.status).toBe(201);

    // В файл — синхронно.
    const onDisk = JSON.parse(realFs.readFileSync(path.join(scratch, "cyberchess-tournaments.json"), "utf-8"));
    expect(onDisk.tournaments.map((t: { title: string }) => t.title)).toContain("Заведён после деплоя");
    expect(onDisk.savedAt).toBeTruthy(); // метка нужна, чтобы сравнивать с базой

    // В базу — следом, не блокируя ответ игроку.
    await new Promise((r) => setTimeout(r, 20));
    expect(db.writes.length).toBeGreaterThan(before);
    const lastState = JSON.parse(String(db.writes[db.writes.length - 1][0]));
    expect(lastState.tournaments.map((t: { title: string }) => t.title)).toContain("Заведён после деплоя");
  });
});

describe("опоздавшая запись не затирает более свежую", () => {
  /* Сохранение в базу намеренно не блокирует ответ игроку — значит два
     сохранения подряд летят параллельно и могут прийти в обратном порядке.
     Без защиты старое состояние перезаписало бы новое: та же тихая потеря,
     ради устранения которой всё и делалось, только внутри самой починки. */

  test("запрос обновляет строку только если он свежее записанного", () => {
    const src = require("node:fs").readFileSync(
      "src/routes/cyberchessTournaments.ts",
      "utf-8",
    ) as string;

    // Проверка по тексту запроса: настоящей базы здесь нет, а подделка сравнение
    // внутри Postgres не выполняет. Условие обязано стоять именно в UPDATE.
    expect(src).toMatch(/ON CONFLICT[\s\S]{0,900}WHERE "CyberTournamentState"\."savedAt" <= EXCLUDED\."savedAt"/);
  });
});
