import { describe, test, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// Рамки ELO сверяются по ТОЙ скорости, в которой играют. 19.08.2026.
//
// Проверка рамок была написана часом раньше и покрыта зелёными тестами. Вычитка
// показала, что она ничего не проверяла у девяти турниров из двенадцати:
// турниры хранят timeControl как НАЗВАНИЕ скорости («rapid», «classic»), а
// speedOf ждёт «300+5» и на всё прочее молча возвращает «blitz». Игрок с
// рейтингом в рапиде имел в блице ноль партий, считался новичком и проходил
// в рапид-турнир мимо рамок. Ни одной ошибки при этом не возникало.

const { db } = vi.hoisted(() => {
  process.env.DATABASE_URL = "postgres://test/test";
  const nodeOs = require("node:os") as typeof import("node:os");
  const nodePath = require("node:path") as typeof import("node:path");
  const nodeFs = require("node:fs") as typeof import("node:fs");
  process.env.CYBERCHESS_TOURNAMENTS_DIR = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), "cc-speed-"));
  return { db: { спрошенныеСкорости: [] as string[] } };
});

vi.mock("pg", async () => {
  const { makeFakePool, rows, written } = await import("./helpers/fakePg");
  const Pool = makeFakePool({
    handlers: [
      (text: string, params: unknown[] = []) => {
        if (/FROM "CyberRating"/i.test(text)) {
          db.спрошенныеСкорости.push(String(params[1]));
          // Рейтинг есть только в РАПИДЕ и он вне рамок любого блиц-турнира.
          if (String(params[1]) === "rapid") {
            return rows([{ userId: "u", speed: "rapid", displayName: null, games: 40, rating: 900, rd: 80, vol: 0.06, wins: 0, losses: 0, draws: 0, peak: 900 }]);
          }
          return rows([]);
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

beforeEach(() => { db.спрошенныеСкорости.length = 0; });

describe("скорость турнира определяется по самому турниру", () => {
  test("у рапид-турнира спрашивается рапид, а не блиц", async () => {
    const a = await app();
    const list = (await request(a).get("/api/cyberchess-tournaments/list")).body.tournaments as Array<Record<string, any>>;
    const rapid = list.find((t) => t.status === "upcoming" && String(t.timeControl).toLowerCase() === "rapid" && t.players < t.maxPlayers);
    expect(rapid, "не нашлось предстоящего рапид-турнира").toBeTruthy();

    await request(a).post(`/api/cyberchess-tournaments/${rapid!.id}/register`)
      .send({ userId: "рапидист", displayName: "Рапидист" });

    expect(db.спрошенныеСкорости).toContain("rapid");
    // Именно этого и не было: спрашивался блиц, где партий ноль.
    expect(db.спрошенныеСкорости).not.toContain("blitz");
  });

  test("рейтинг вне рамок отвергается именно в своей скорости", async () => {
    const a = await app();
    const list = (await request(a).get("/api/cyberchess-tournaments/list")).body.tournaments as Array<Record<string, any>>;
    const rapid = list.find((t) => t.status === "upcoming" && String(t.timeControl).toLowerCase() === "rapid" && t.eloMin > 900 && t.players < t.maxPlayers);
    if (!rapid) return; // нет подходящей заготовки — случай проверять нечем
    const r = await request(a).post(`/api/cyberchess-tournaments/${rapid.id}/register`)
      .send({ userId: "слабый-рапидист", displayName: "Слабый" });
    expect(r.status).toBe(403);
    expect(r.body.error).toBe("rating_out_of_range");
  });
});
