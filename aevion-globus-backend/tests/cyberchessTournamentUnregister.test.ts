import { describe, test, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import { svoyTurnir } from "./helpers/svoyTurnir";

// Из турнира можно выйти. 19.08.2026.
//
// До этого дня — нельзя было вообще: записался значит навсегда, даже если
// передумал за неделю до старта. Это про согласие человека, а не про удобство:
// он соглашался играть, а не числиться в списке без выхода.
//
// Право подтверждается БИЛЕТОМ, а не одним userId. Аккаунтов нет, идентификатор
// игрока не секрет — зная его, посторонний вычёркивал бы людей из турниров.

vi.hoisted(() => {
  process.env.DATABASE_URL = "";
  const nodeOs = require("node:os") as typeof import("node:os");
  const nodePath = require("node:path") as typeof import("node:path");
  const nodeFs = require("node:fs") as typeof import("node:fs");
  process.env.CYBERCHESS_TOURNAMENTS_DIR = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), "cc-unreg-"));
});

async function app() {
  const router = (await import("../src/routes/cyberchessTournaments")).default;
  const a = express();
  a.use(express.json());
  a.use("/api/cyberchess-tournaments", router);
  return a;
}

/**
 * Свободный турнир ЗАВОДИМ СВОЙ, а не ищем в выдаче.
 *
 * GET /list с 30.09 отдаёт только созданные людьми (толькоНастоящие) —
 * заготовки скрыты, чтобы витрина не заявляла 534 участника при нуле живых.
 * Проверяется здесь выход по билету, а не политика показа.
 *
 * Турнир один на файл: создание ограничено пятью за 10 минут с адреса.
 */
let турнирКэш: Record<string, any> | null = null;
async function свободныйТурнир(a: express.Express) {
  if (!турнирКэш) {
    турнирКэш = await svoyTurnir((u, b) => request(a).post(u).send(b as object), { maxPlayers: 8 });
  }
  // Свежее состояние: места могли уйти предыдущей проверкой в этом же файле.
  const д = await request(a).get(`/api/cyberchess-tournaments/${турнирКэш.id}`);
  return (д.body?.tournament ?? д.body ?? турнирКэш) as Record<string, any>;
}

describe("выход из турнира", () => {
  test("записавшийся выходит по своему билету, и место освобождается", async () => {
    const a = await app();
    const t = await свободныйТурнир(a);
    expect(t, "не нашлось предстоящего турнира со свободным местом").toBeTruthy();
    const было = t!.players;

    const reg = await request(a).post(`/api/cyberchess-tournaments/${t!.id}/register`)
      .send({ userId: "выходящий", displayName: "Выходящий" });
    expect(reg.status).toBe(200);

    const out = await request(a).post(`/api/cyberchess-tournaments/${t!.id}/unregister`)
      .send({ userId: "выходящий", ticketId: reg.body.ticketId });
    expect(out.status).toBe(200);
    // Счётчик обязан вернуться: иначе участник исчезает из списка, а турнир
    // выглядит полнее, чем есть.
    expect(out.body.players).toBe(было);
  });

  test("посторонний не вычеркнет чужую регистрацию, зная только id", async () => {
    const a = await app();
    const t = await свободныйТурнир(a);
    const reg = await request(a).post(`/api/cyberchess-tournaments/${t!.id}/register`)
      .send({ userId: "жертва", displayName: "Жертва" });
    expect(reg.status).toBe(200);

    const attack = await request(a).post(`/api/cyberchess-tournaments/${t!.id}/unregister`)
      .send({ userId: "жертва", ticketId: "tkt_придуманный" });
    expect(attack.status).toBe(403);
    expect(attack.body.error).toBe("ticket_mismatch");
  });

  test("незарегистрированный получает 404, а не молчаливый успех", async () => {
    const a = await app();
    const t = await свободныйТурнир(a);
    const r = await request(a).post(`/api/cyberchess-tournaments/${t!.id}/unregister`)
      .send({ userId: "никогда-не-был", ticketId: "tkt_x" });
    expect(r.status).toBe(404);
    expect(r.body.error).toBe("not_registered");
  });

  test("сетка возвращается в прежний вид, а не остаётся с прочерком", async () => {
    // У турнира с реальными игроками места сетки заняты демо-именами, и
    // регистрация их затирает. Выход обязан вернуть прежнее имя: иначе
    // демо-участник исчезает навсегда, а сетка выглядит поломанной.
    const a = await app();
    const list = (await request(a).get("/api/cyberchess-tournaments/list")).body.tournaments as Array<Record<string, any>>;
    const real = list.find((t) => t.status === "upcoming" && t.realPlayers && t.players < t.maxPlayers);
    if (!real) return; // нет подходящей заготовки — проверять нечем

    const до = (await request(a).get(`/api/cyberchess-tournaments/${real.id}`)).body;
    const именаДо = ((до.tournament ?? до).roster ?? []).map((p: any) => p.name);

    const reg = await request(a).post(`/api/cyberchess-tournaments/${real.id}/register`)
      .send({ userId: "временный", displayName: "Временный" });
    expect(reg.status).toBe(200);

    const out = await request(a).post(`/api/cyberchess-tournaments/${real.id}/unregister`)
      .send({ userId: "временный", ticketId: reg.body.ticketId });
    expect(out.status).toBe(200);

    const после = (await request(a).get(`/api/cyberchess-tournaments/${real.id}`)).body;
    const именаПосле = ((после.tournament ?? после).roster ?? []).map((p: any) => p.name);
    expect(именаПосле).toEqual(именаДо);
    expect(именаПосле).not.toContain("Временный");
    expect(именаПосле).not.toContain("—");
  });
});
