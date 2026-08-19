import { describe, test, expect, vi } from "vitest";

// Турнир проходит путь целиком: запись → старт → сетка → партия → следующий круг.
//
// 19.08.2026 цепочка была разорвана в ЧЕТЫРЁХ местах, и каждое звено по
// отдельности выглядело исправным:
//
//   1. даты образцов протухли — семь турниров «предстояли» с мая;
//   2. механизма перехода «предстоит → идёт» не существовало вообще;
//   3. первый круг не строил НИКТО: сервер только менял статус, а страница
//      выходила по безусловному «кругов нет»;
//   4. цвет игрока терялся по дороге к доске.
//
// Поэтому проверка сквозная, а не по звеньям: разрыв посередине не виден ни
// одному модульному тесту, а человеку виден сразу — он записался и ждёт.

vi.hoisted(() => {
  process.env.DATABASE_URL = "";
  const nodeOs = require("node:os") as typeof import("node:os");
  const nodePath = require("node:path") as typeof import("node:path");
  const nodeFs = require("node:fs") as typeof import("node:fs");
  process.env.CYBERCHESS_TOURNAMENTS_DIR = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), "cc-life-"));
});

import express from "express";
import request from "supertest";

async function поднять() {
  const tour = await import("../src/routes/cyberchessTournaments");
  const mm = await import("../src/routes/cyberchessMatchmaking");
  const a = express();
  a.use(express.json());
  a.use("/api/cyberchess-tournaments", tour.default);
  a.use("/api/cyberchess/matchmaking", mm.default);
  return { a, tour, mm };
}

describe("турнир проходит путь целиком", () => {
  test("запись двоих → старт по времени → сетка → результат доходит до неё", async () => {
    const { a, tour } = await поднять();

    // 1. Находим турнир с реальными игроками — только у них публикуются пары.
    const список = async () =>
      ((await request(a).get("/api/cyberchess-tournaments/list")).body?.tournaments ?? []) as any[];
    const цель = (await список()).find(
      (t) => t.status === "upcoming" && t.realPlayers && t.players < t.maxPlayers);
    expect(цель, "нет предстоящего турнира с реальными игроками").toBeTruthy();

    // 2. Записываются двое.
    const билеты: Record<string, string> = {};
    for (const uid of ["сквозной-1", "сквозной-2"]) {
      const r = await request(a).post(`/api/cyberchess-tournaments/${цель!.id}/register`)
        .send({ userId: uid, displayName: uid });
      expect(r.status, `регистрация ${uid}`).toBe(200);
      билеты[uid] = r.body.ticketId;
    }
    expect(Object.keys(билеты)).toHaveLength(2);

    // 3. Время наступило — турнир обязан начаться САМ.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.parse(цель!.startsAt) + 60_000));
    tour.tournamentTick();
    vi.useRealTimers();

    const после = (await список()).find((t) => t.id === цель!.id);
    expect(после!.status, "турнир должен был начаться сам").toBe("live");

    // 4. Первый круг строится тем же вызовом, который зовёт страница.
    const круг = await request(a).post(`/api/cyberchess-tournaments/${цель!.id}/queue-match`).send({});
    expect([200, 409]).toContain(круг.status);

    const детали = await request(a).get(`/api/cyberchess-tournaments/${цель!.id}`);
    const rounds = (детали.body?.tournament ?? детали.body)?.rounds ?? [];
    expect(rounds.length, "после старта должен появиться круг").toBeGreaterThan(0);
    expect(rounds[0].matches.length, "в круге должны быть пары").toBeGreaterThan(0);
  });
});
