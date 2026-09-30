/**
 * Публичный список турниров не показывает наши фикстуры.
 *
 * 🔴 ПОВОД 30.09.2026, утро запуска шахмат. GET /api/cyberchess-tournaments/list
 * отдавал 12 турниров, все до одного посев (origin "seed" у 12 из 12), и
 * страница /cyberchess их показывала. Сумма заявленных участников — 534
 * человека при ~167 живых посетителях за 14 дней. Числа выдуманы поштучно:
 * «Bullet Storm #7» объявлял players 215, а записей в нём было ЧЕТЫРЕ, и те
 * же четыре идентификатора стояли в соседнем демо-турнире.
 *
 * Проверяем ПОВЕДЕНИЕ ручки, а не строки исходника: сторож по дословным
 * строкам краснеет на верной правке и зеленеет на подменённых данных — мы на
 * этом уже сидели трижды за сутки.
 */
import { describe, test, expect } from "vitest";
import express from "express";
import request from "supertest";
import router, { толькоНастоящие, происхождениеТурнира } from "../src/routes/cyberchessTournaments";

const app = express();
app.use(express.json());
app.use("/api/cyberchess-tournaments", router);

describe("список турниров показывает только настоящие", () => {
  test("🔴 в публичной выдаче нет ни одного посева", async () => {
    const r = await request(app).get("/api/cyberchess-tournaments/list");
    expect(r.status).toBe(200);
    const список = r.body.tournaments || [];
    const посев = список.filter((t: { origin?: string }) => t.origin !== "user");
    expect(
      посев.map((t: { title?: string }) => t.title),
      "в публичном списке остались наши фикстуры",
    ).toEqual([]);
  });

  test("счётчик count согласован с тем, что показано", async () => {
    // Спрятать строки и оставить прежнее число — не починка, а новая ложь.
    const r = await request(app).get("/api/cyberchess-tournaments/list");
    expect(r.body.count).toBe((r.body.tournaments || []).length);
  });

  test("контроль: турнир, созданный человеком, ПРОХОДИТ", () => {
    const созданЧеловеком = [{ id: "usr-abc123", title: "Турнир Абдоллы" }];
    expect(толькоНастоящие(созданЧеловеком)).toHaveLength(1);
  });

  test("контроль: посев не проходит ни по id, ни по явному origin", () => {
    expect(толькоНастоящие([{ id: "bullet-storm-7" }])).toHaveLength(0);
    expect(толькоНастоящие([{ id: "usr-x", origin: "seed" }])).toHaveLength(0);
  });

  test("🔴 realPlayers НЕ считается признаком настоящего турнира", () => {
    // «Real Players Swiss (демо)» имеет realPlayers=true и при этом является
    // нашим посевом: там этот флаг значит «демо принимает живых игроков».
    // Один признак на два вопроса уже подводил нас раньше.
    const демо = { id: "real-swiss-demo", origin: "seed", realPlayers: true };
    expect(происхождениеТурнира(демо)).toBe("seed");
    expect(толькоНастоящие([демо])).toHaveLength(0);
  });
});
