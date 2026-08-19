import { describe, test, expect, vi } from "vitest";
import express from "express";
import request from "supertest";

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

async function свободныйТурнир(a: express.Express) {
  const r = await request(a).get("/api/cyberchess-tournaments/list");
  const list = (r.body?.tournaments ?? []) as Array<Record<string, any>>;
  return list.find((t) => t.status === "upcoming" && t.players < t.maxPlayers);
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
});
