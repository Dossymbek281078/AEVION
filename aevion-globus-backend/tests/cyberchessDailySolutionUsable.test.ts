import { describe, test, expect, vi } from "vitest";
import express from "express";
import request from "supertest";

// Задачу дня должно быть ВОЗМОЖНО РЕШИТЬ. 19.08.2026.
//
// Дефект, проживший день на проде: колонка `sol` — текст с JSON-массивом
// внутри (`["c5c3","e6e4"]`), а код проверял `Array.isArray` и, не найдя
// массива, резал строку по запятым. В ответе оказывались «ходы» вида `["c5c3"`
// и `"e6e4"` — со скобками и кавычками. Ни один ход игрока с таким мусором не
// совпадёт: задача была нерешаемой, а подсказка показывала `["c5c3"`.
//
// Почему это пережило пять проверок на боевой базе. Они спрашивали «пришла ли
// задача из банка» и «разные ли задачи по дням» — и обе честно отвечали да.
// Ни одна не спросила про содержимое. Правильный вопрос о неправильном
// предмете тише, чем отсутствующая проверка: он создаёт ощущение охвата.
//
// Отдельный файл нужен из-за кэша задачи на день: внутри одного модуля второй
// вход уже не доедет до разбора.

const { db } = vi.hoisted(() => {
  process.env.DATABASE_URL = "postgres://test/test";
  return { db: { solRaw: '["c5c3","e6e4","b5b4","e4b4"]' } };
});


// Тест не имеет права писать в данные репозитория. Без этого блока прогон
// мутации (где сервер снова верил клиенту) записал «серию 364» в отслеживаемый
// файл `data/cyberchess-daily-leaderboard.json` — и она уехала бы в коммит как
// настоящая запись живого игрока. Соседний тест 12.08 стережёт ровно это, а мой
// собственный новый файл в ту же яму и попал.
vi.hoisted(() => {
  const nodeOs = require("node:os") as typeof import("node:os");
  const nodePath = require("node:path") as typeof import("node:path");
  const nodeFs = require("node:fs") as typeof import("node:fs");
  process.env.CYBERCHESS_DAILY_DIR = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), "cc-daily-"));
});

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: async (text: string) => {
      if (/count\(\*\)/i.test(text)) return { rows: [{ n: 500000 }], rowCount: 1 };
      if (/FROM "ChessPuzzle"/i.test(text)) {
        return {
          rows: [{ id: "li_2AEIG", fen: "r4k1r/pp3p2/4qp2/1QR5/5Pp1/1N4P1/PPP5/R5K1 w - - 2 25", sol: db.solRaw, name: "Тактика", rating: 1931, theme: "Миттельшпиль" }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    },
  }),
  isDbConfigured: () => true,
}));

const UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

describe("решение задачи дня пригодно к игре", () => {
  test("ходы приходят ходами, а не обрывками JSON", async () => {
    const dailyRouter = (await import("../src/routes/cyberchessDaily")).default;
    const app = express();
    app.use(express.json());
    app.use("/api/cyberchess-daily", dailyRouter);
    const r = await request(app).get("/api/cyberchess-daily/puzzle");
    expect(r.status).toBe(200);
    expect(r.body.source).toContain("банк");
    expect(r.body.puzzle.sol).toEqual(["c5c3", "e6e4", "b5b4", "e4b4"]);
    for (const m of r.body.puzzle.sol) expect(m).toMatch(UCI);
    // Подсказка — ход, а не обрывок строки: это и охранялось изначально, и
    // остаётся в силе. Но 30.09.2026 ЗНАЧЕНИЕ поправлено с "c5c3" на "e6e4",
    // и вот почему.
    //
    // Решение здесь чётной длины (4 хода) — по правилу проекта
    // (frontend/src/app/cyberchess/puzzleNormalize.ts, isRawLichess) это
    // СЫРОЙ формат lichess: `fen` показывает позицию ДО хода соперника, а
    // человек ходит вторым. Сверка по самой позиции: в fen стоит `w`, и
    // "c5c3" — ход белой ладьи с c5, то есть его делает СОПЕРНИК. Играет
    // человек "e6e4" — ферзём.
    //
    // Фронт ровно так задачу и рисует: доска показывает позицию ПОСЛЕ
    // sol[0]. Подсказка "c5c3" называла бы ход, уже сделанный на экране.
    // Проверено живьём на проде 30.09 на настоящей задаче дня: fen с ходом
    // белых, sol f2g1,d7g4,…; на доске король уже стоял на g1, то есть
    // спрашивали ход чёрных.
    //
    // Ручка публичная, и подсказкой пользуемся не только мы — поэтому
    // чинится на сервере (src/lib/dailyHint.ts), а не на экране.
    expect(r.body.puzzle.solHint).toBe("e6e4");
    expect(r.body.puzzle.solHint).not.toBe(r.body.puzzle.sol[0]);
  });
});
