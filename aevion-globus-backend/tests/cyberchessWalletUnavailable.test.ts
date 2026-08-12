import { describe, test, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";

// GET /wallet и /wallet/leaderboard, когда база не отвечает. 2026-08-12.
//
// Обе ручки читают через обёртку, которая ловит ошибку запроса и возвращает
// пустой список. Дальше пустота молча превращалась в утверждение:
//
//   * /wallet отвечал `ok:true, balance:0` — «этот человек ничего не
//     заработал», не выполнив ни одного успешного запроса;
//   * /wallet/leaderboard отвечал `ok:true, count:0`, а страница подписывает
//     такой ответ словами «Пока никто не заработал Chessy в реальных матчах» —
//     это заявление обо ВСЕХ игроках сразу.
//
// Ноль и пустой список — законные ответы, когда база ответила. Отличать их от
// «спросить не удалось» должен сервер: у клиента для этого нет ничего.

const { failing } = vi.hoisted(() => {
  // Внутри hoisted, а не рядом с импортом: `import` поднимается выше обычных
  // присваиваний, и без этого хранилище инициализируется БЕЗ DATABASE_URL. Тогда
  // 503 приходит из ветки «базы нет вовсе», а проверяем мы ветку «запрос упал» —
  // тест был бы зелёным по неверной причине. Сторожит это третий тест: при
  // отвечающей базе ответ обязан быть 200.
  process.env.DATABASE_URL = "postgres://test/test";
  return { failing: { on: true } };
});

vi.mock("pg", () => {
  class Pool {
    async query(text: string) {
      // Создание таблиц при инициализации должно проходить: иначе хранилище
      // сочтётся выключенным, и тест проверял бы offline-ветку вместо отказа.
      if (/CREATE TABLE|CREATE INDEX/i.test(text)) return { rows: [] };
      if (failing.on) throw new Error("connection reset by peer");
      // count(*) в Postgres ВСЕГДА отдаёт строку — на этом и держится различие
      // «ноль долгов» против «спросить не удалось». Подделка, возвращающая на
      // такой запрос пустоту, выглядела бы как отказ и проверяла бы не то.
      if (/count\(\*\)/i.test(text)) return { rows: [{ n: 0 }] };
      return { rows: [] };
    }
    on() {}
  }
  return { default: { Pool }, Pool };
});

import matchmakingRouter from "../src/routes/cyberchessMatchmaking";
import { resetCounterCache } from "../src/routes/cyberchessMatchStore";

const app = express();
app.use(express.json());
app.use("/api/cyberchess/matchmaking", matchmakingRouter);

beforeEach(() => {
  failing.on = true;
  // Счётчики диагностики кэшируются на 30 с (ручка публичная, два запроса к базе
  // на вызов). Тесты переключают состояние базы внутри одного процесса, поэтому
  // кэш надо сбрасывать — иначе проверялся бы прошлый ответ.
  resetCounterCache();
});

describe("отказ базы не выдаётся за факт о деньгах", () => {
  test("баланс игрока: 503, а не нулевой баланс", async () => {
    const res = await request(app).get("/api/cyberchess/matchmaking/wallet?userId=player-7");

    expect(res.status).toBe(503);
    expect(res.body.ok).toBe(false);
    expect(res.body.balance).toBeUndefined();
  });

  test("таблица балансов: 503, а не пустая таблица", async () => {
    const res = await request(app).get("/api/cyberchess/matchmaking/wallet/leaderboard?limit=50");

    expect(res.status).toBe(503);
    expect(res.body.ok).toBe(false);
    expect(res.body.count).toBeUndefined();
  });

  test("рейтинг игрока: 503, а не новичковые 1500", async () => {
    // Пустой ответ здесь означал бы «игрок не играл», а сильному игроку —
    // что его рейтинга не существует.
    const res = await request(app).get("/api/cyberchess/matchmaking/rating?userId=strong");

    expect(res.status).toBe(503);
    expect(res.body.ratings).toBeUndefined();
  });

  test("таблица рейтингов: 503, а не «игроков нет»", async () => {
    const res = await request(app).get("/api/cyberchess/matchmaking/leaderboard?speed=blitz");

    expect(res.status).toBe(503);
    expect(res.body.count).toBeUndefined();
  });

  test("история партий: 503, а не «партий нет»", async () => {
    // У человека может быть двести партий; «пусто» тут — заявление о его жизни
    // в игре, а не о состоянии базы.
    const res = await request(app).get("/api/cyberchess/matchmaking/history?userId=strong");

    expect(res.status).toBe(503);
    expect(res.body.matches).toBeUndefined();
  });

  test("счётчик зависших выплат доезжает до /debug/stats", async () => {
    // У тревоги должен быть читатель. Поле существует ради того, чтобы провал
    // выплаты был виден не только строкой в логе, — а поле, которого нет в
    // ответе, ровно так же невидимо.
    failing.on = false;
    const res = await request(app).get("/api/cyberchess/matchmaking/debug/stats");

    expect(res.status).toBe(200);
    expect(res.body.awards).toBeDefined();
    expect(res.body.awards.unpaid).toBe(0);
  });

  test("сверка кошелька с рейтингом тоже видна и тоже честна", async () => {
    // Баланс без рейтинговых партий — след синтетики в боевых данных или
    // пропущенной записи рейтинга. Замечать это глазами по двум ручкам сразу,
    // как пришлось 12.08, — не способ.
    failing.on = false;
    const ok = await request(app).get("/api/cyberchess/matchmaking/debug/stats");
    expect(ok.body.wallets.withoutRatedGames).toBe(0);

    failing.on = true;
    resetCounterCache(); // иначе вернётся закэшированный ответ живой базы
    const down = await request(app).get("/api/cyberchess/matchmaking/debug/stats");
    expect(down.body.wallets.withoutRatedGames).toBeNull();
  });

  test("на упавшем запросе счётчик показывает null, а не ноль", async () => {
    // Ноль здесь читался бы как «долгов нет» — заявление, которого никто не
    // проверял, причём именно в тот момент, когда база не отвечает.
    const res = await request(app).get("/api/cyberchess/matchmaking/debug/stats");

    expect(res.status).toBe(200);
    expect(res.body.awards.unpaid).toBeNull();
  });

  test("когда база отвечает, честный ноль остаётся нулём", async () => {
    // Обратная сторона: сторож не должен превращать нормальный ответ в отказ.
    // Игрок без строки в кошельке — это настоящий ноль, и он должен доехать.
    failing.on = false;

    const wallet = await request(app).get("/api/cyberchess/matchmaking/wallet?userId=nobody");
    expect(wallet.status).toBe(200);
    expect(wallet.body).toMatchObject({ ok: true, balance: 0, earnedTotal: 0 });

    const board = await request(app).get("/api/cyberchess/matchmaking/wallet/leaderboard?limit=50");
    expect(board.status).toBe(200);
    expect(board.body).toMatchObject({ ok: true, count: 0 });
  });
});
