import { describe, test, expect, afterAll, vi } from "vitest";
import * as realFs from "node:fs";
import express from "express";
import request from "supertest";

// Регистрация без идентификатора говорит, что выдала свой. 19.08.2026.
//
// Замер: страница списка турниров читала ключ, который пишется только при
// входе, и у посетителя без аккаунта отправляла пустое поле. Бэкенд выдавал
// новый anon_… на КАЖДЫЙ запрос — значит защита «уже зарегистрирован»
// обходилась по построению: один человек мог набить турнир призраками, и билет
// было не восстановить.
//
// Клиент починен, но контракт обязан быть явным: без признака вызывающий не
// знает, что идентификатор надо сохранить, и повторит ту же ошибку.

const { dir } = vi.hoisted(() => {
  const fs = require("node:fs") as typeof import("node:fs");
  const os = require("node:os") as typeof import("node:os");
  const p = require("node:path") as typeof import("node:path");
  const d = fs.mkdtempSync(p.join(os.tmpdir(), "cc-reg-"));
  process.env.CYBERCHESS_TOURNAMENTS_DIR = d;
  fs.writeFileSync(
    p.join(d, "cyberchess-tournaments.json"),
    JSON.stringify({
      savedAt: new Date().toISOString(),
      tournaments: [
        {
          id: "t1", title: "Турнир", format: "swiss", timeControl: "blitz",
          eloMin: 0, eloMax: 3000, players: 0, maxPlayers: 8, prizeChessy: 0,
          status: "upcoming", startsAt: "2026-09-01T10:00:00.000Z",
          registeredUserIds: [], roster: [], rounds: [], origin: "user",
        },
      ],
    }),
    "utf-8",
  );
  return { dir: d };
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
    realFs.rmSync(dir, { recursive: true, force: true });
  } catch {
    /* временный каталог */
  }
});

describe("контракт регистрации по идентификатору", () => {
  test("свой идентификатор принят и признак не выставлен", async () => {
    const res = await request(app)
      .post("/api/cyberchess-tournaments/t1/register")
      .send({ userId: "u_настоящий", displayName: "Игрок" });

    expect(res.status).toBe(200);
    expect(res.body.userId).toBe("u_настоящий");
    expect(res.body.userIdGenerated).toBe(false);
  });

  test("без идентификатора выдан свой, и об этом СКАЗАНО", async () => {
    const res = await request(app)
      .post("/api/cyberchess-tournaments/t1/register")
      .send({ displayName: "Аноним" });

    expect(res.status).toBe(200);
    expect(res.body.userId).toMatch(/^anon_/);
    // Ключевое: без этого признака клиент не знает, что идентификатор надо
    // сохранить, и следующий клик заведёт ещё одного игрока.
    expect(res.body.userIdGenerated).toBe(true);
  });

  test("пустая строка считается отсутствием, а не идентификатором", async () => {
    // Иначе «зарегистрируй пустого» прошло бы как обычная регистрация, и все
    // такие посетители склеились бы в одного игрока с пустым id.
    const res = await request(app)
      .post("/api/cyberchess-tournaments/t1/register")
      .send({ userId: "   ", displayName: "Пробелы" });

    expect(res.body.userIdGenerated).toBe(true);
    expect(res.body.userId).toMatch(/^anon_/);
  });
});
