import { describe, test, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// Объявленный диапазон рейтинга обеспечивается. 19.08.2026.
//
// На карточке турнира написано «ELO 1800–2400», и человек читает это как
// ограничение. Проверялось оно НИГДЕ: зарегистрироваться мог кто угодно.
// Обещание, которого продукт не держит, — первый пункт ворот запуска.
//
// Тот же класс, что подделка серии и заявленный рейтинг в очереди, найденные
// сегодня же: значение, за которое отвечает сервер, бралось со стороны клиента
// или не проверялось вовсе.

const { db } = vi.hoisted(() => {
  process.env.DATABASE_URL = "postgres://test/test";
  // Турниры сохраняют состояние в файл. Без своего каталога тест писал бы в
  // data/cyberchess-tournaments.json репозитория: мои регистрации переживали
  // прогон, и второй запуск получал 409 «уже зарегистрирован». Ровно ту же яму
  // я нашёл сегодня утром в тесте задачи дня — она общая для всего модуля.
  const nodeOs = require("node:os") as typeof import("node:os");
  const nodePath = require("node:path") as typeof import("node:path");
  const nodeFs = require("node:fs") as typeof import("node:fs");
  process.env.CYBERCHESS_TOURNAMENTS_DIR = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), "cc-tour-"));
  return { db: { games: 0, rating: 1200, отвечает: true } };
});

vi.mock("pg", async () => {
  const { makeFakePool, rows, written } = await import("./helpers/fakePg");
  const Pool = makeFakePool({
    handlers: [
      (text: string) => {
        if (!db.отвечает) throw new Error("connection terminated unexpectedly");
        if (/FROM "CyberRating"/i.test(text)) {
          return rows([{ userId: "u", speed: "blitz", displayName: null, games: db.games, rating: db.rating, rd: 100, vol: 0.06, wins: 0, losses: 0, draws: 0, peak: db.rating }]);
        }
        return written(0);
      },
    ],
  });
  return { default: { Pool }, Pool };
});

async function app() {
  const router = (await import("../src/routes/cyberchessTournaments")).default;
  const a = express();
  a.use(express.json());
  a.use("/api/cyberchess-tournaments", router);
  return a;
}

// Турнир с рамками берём из выдачи, а не зашиваем: зашитый id разъедется с
// набором заготовок при первой его правке.
async function турнирСРамками(a: express.Express) {
  const r = await request(a).get("/api/cyberchess-tournaments/list");
  const list = (r.body?.tournaments ?? []) as Array<Record<string, any>>;
  return list.find((t) => t.status === "upcoming" && t.eloMin > 0 && t.players < t.maxPlayers);
}

beforeEach(() => { db.games = 0; db.rating = 1200; db.отвечает = true; });

describe("в турнир не пускают мимо объявленных рамок", () => {
  test("игрок с рейтингом ниже нижней границы получает понятный отказ", async () => {
    const a = await app();
    const t = await турнирСРамками(a);
    expect(t, "не нашлось предстоящего турнира с рамками").toBeTruthy();
    db.games = 30;
    db.rating = Math.max(100, t!.eloMin - 300);
    const r = await request(a).post(`/api/cyberchess-tournaments/${t!.id}/register`)
      .send({ userId: "слабый", displayName: "Слабый" });
    expect(r.status).toBe(403);
    expect(r.body.error).toBe("rating_out_of_range");
    expect(String(r.body.hint)).toContain(String(db.rating));
  });

  test("игрок внутри рамок регистрируется, и это помечено как проверенное", async () => {
    const a = await app();
    const t = await турнирСРамками(a);
    db.games = 30;
    db.rating = Math.round((t!.eloMin + t!.eloMax) / 2);
    const r = await request(a).post(`/api/cyberchess-tournaments/${t!.id}/register`)
      .send({ userId: "подходящий", displayName: "Подходящий" });
    expect(r.status).toBe(200);
    expect(r.body.eloChecked).toBe("по рейтингу");
  });

  test("игрока без сыгранных партий пускают, и ответ говорит почему", async () => {
    // Иначе к 30.08 турниры были бы пусты: рейтинга ещё не существует ни у кого.
    const a = await app();
    const t = await турнирСРамками(a);
    db.games = 0;
    const r = await request(a).post(`/api/cyberchess-tournaments/${t!.id}/register`)
      .send({ userId: "новичок", displayName: "Новичок" });
    expect(r.status).toBe(200);
    expect(r.body.eloChecked).toBe("рейтинга нет");
  });
});
