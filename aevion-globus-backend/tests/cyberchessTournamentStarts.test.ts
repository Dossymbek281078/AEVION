import { describe, test, expect, vi, beforeEach } from "vitest";

// Турнир начинается в назначенное время. 19.08.2026.
//
// Замер на боевом проде: семь турниров из двенадцати числились «предстоящими»,
// а время старта прошло 88–94 дня назад. Механизма перехода «предстоит → идёт»
// НЕ СУЩЕСТВОВАЛО: поле startsAt записывалось при создании и ни разу ни с чем
// не сравнивалось. Объяви турнир к запуску — он бы не начался, а записавшиеся
// ждали бы.
//
// Граница, которую проверяют эти случаи: настоящий турнир начинается, образец
// без участников — НЕ начинается, а сдвигается. Начать образец значило бы
// показать игру демо-участников как настоящую.

vi.hoisted(() => {
  process.env.DATABASE_URL = "";
  const nodeOs = require("node:os") as typeof import("node:os");
  const nodePath = require("node:path") as typeof import("node:path");
  const nodeFs = require("node:fs") as typeof import("node:fs");
  process.env.CYBERCHESS_TOURNAMENTS_DIR = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), "cc-starts-"));
});

import express from "express";
import request from "supertest";

async function модуль() {
  return await import("../src/routes/cyberchessTournaments");
}
async function приложение() {
  const m = await модуль();
  const a = express();
  a.use(express.json());
  a.use("/api/cyberchess-tournaments", m.default);
  return a;
}
async function список(a: express.Express) {
  const r = await request(a).get("/api/cyberchess-tournaments/list");
  return (r.body?.tournaments ?? []) as Array<Record<string, any>>;
}

describe("турниры начинаются сами", () => {
  test("турнир с участниками переходит в «идёт», когда время наступило", async () => {
    const a = await приложение();
    const m = await модуль();
    const свободный = (await список(a)).find(
      (t) => t.status === "upcoming" && t.players < t.maxPlayers);
    expect(свободный, "нет предстоящего турнира со свободным местом").toBeTruthy();

    for (const uid of ["игрок-1", "игрок-2"]) {
      const r = await request(a).post(`/api/cyberchess-tournaments/${свободный!.id}/register`)
        .send({ userId: uid, displayName: uid });
      expect(r.status).toBe(200);
    }

    // Пока время в будущем — ничего не происходит. Это половина утверждения:
    // механизм, который стартует РАНЬШЕ срока, так же плох, как не стартующий.
    m.tournamentTick();
    expect((await список(a)).find((x) => x.id === свободный!.id)!.status).toBe("upcoming");

    // Время наступило.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.parse(свободный!.startsAt) + 60_000));
    m.tournamentTick();
    vi.useRealTimers();

    expect((await список(a)).find((x) => x.id === свободный!.id)!.status).toBe("live");
  });

  test("образец БЕЗ участников не начинается, а сдвигается вперёд", async () => {
    // Начать его значило бы показать игру демо-участников как настоящую — ровно
    // та выдумка, которую мы из модуля вычищали.
    const a = await приложение();
    const m = await модуль();
    const пустые = (await список(a)).filter(
      (t) => t.status === "upcoming" && t.origin === "seed" && (t.players ?? 0) === 0);
    expect(пустые.length, "не нашлось пустого образца").toBeGreaterThan(0);
    const до = new Map(пустые.map((t) => [t.id, t.startsAt]));

    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.now() + 30 * 24 * 3600_000));
    m.tournamentTick();
    vi.useRealTimers();

    const после = (await список(a)).filter((t) => до.has(t.id));
    expect(после.every((t) => t.status === "upcoming"), "образец не должен начинаться").toBe(true);
    expect(после.every((t) => t.startsAt !== до.get(t.id)), "дата должна сдвинуться").toBe(true);
  });
});
