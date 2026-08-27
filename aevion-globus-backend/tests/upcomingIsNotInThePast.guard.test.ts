import { describe, test, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
// Статический импорт, а не `await import()` внутри makeApp: первый холодный
// импорт этого роутера не укладывается в 10 с на тест, и падение приходит на
// загрузке, а не на поведении (см. тот же приём в cyberchessPrizeWebhook).
import { cyberchessRouter, keepOnlyStillUpcoming } from "../src/routes/cyberchess";

/**
 * `/api/cyberchess/upcoming` обещал предстоящее, а отдавал прошедшее.
 *
 * Замер на проде 27.08.2026: ручка возвращала два турнира со статусом
 * `upcoming` и датами старта 4 и 6 мая — при сегодняшнем 27 августа. Причина
 * не в данных: даты демо-образцов вычислялись `Date.now() + 24ч` при ЗАГРУЗКЕ
 * МОДУЛЯ, один раз уезжали в постоянное хранилище, и `ensureDemoSeed` больше
 * не срабатывал, потому что записи уже существовали. Расхождение росло само и
 * перезапуском не лечилось.
 *
 * Зачем сторож. Ручка публичная: она задокументирована на `/bank/api` с
 * готовым примером `curl` и опрашивается из `/bank/diagnostics`. То есть
 * «предстоящие турниры» трёхмесячной давности видел любой, кто открыл нашу
 * же документацию. При этом всё выглядело исправным — 200 и непустой список,
 * ровно тот класс, когда неправильная работа тише отказа.
 */

const { tournaments, mockSave } = vi.hoisted(() => ({
  tournaments: [] as any[],
  mockSave: vi.fn(),
}));

vi.mock("../src/lib/ecosystemStore", () => ({
  loadTournaments: vi.fn(async () => tournaments),
  saveTournament: vi.fn(async (t: any) => {
    mockSave(t);
    const i = tournaments.findIndex((x) => x.id === t.id);
    if (i >= 0) tournaments[i] = t;
    else tournaments.push(t);
  }),
  markTournamentFinalized: vi.fn(),
}));

const DAY = 24 * 3600_000;
const iso = (ms: number) => new Date(ms).toISOString();

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/cyberchess", cyberchessRouter);
  return app;
}

beforeEach(() => {
  tournaments.length = 0;
  mockSave.mockClear();
});

describe("прошедшее не выдаётся как предстоящее", () => {
  test("турнир, чей старт уже прошёл, из ответа выпадает", () => {
    const now = Date.parse("2026-08-27T12:00:00.000Z");
    const items = keepOnlyStillUpcoming(
      [
        { id: "past", startsAt: iso(now - DAY), status: "upcoming" },
        { id: "future", startsAt: iso(now + DAY), status: "upcoming" },
      ] as any,
      now,
    );
    expect(items.map((t) => t.id)).toEqual(["future"]);
  });

  test("граница: старт РОВНО сейчас предстоящим уже не считается", () => {
    const now = Date.parse("2026-08-27T12:00:00.000Z");
    const items = keepOnlyStillUpcoming([{ id: "now", startsAt: iso(now), status: "upcoming" }] as any, now);
    expect(items).toEqual([]);
  });

  test("завершённый турнир не наше дело — фильтр его не трогает", () => {
    const now = Date.parse("2026-08-27T12:00:00.000Z");
    const items = keepOnlyStillUpcoming(
      [{ id: "done", startsAt: iso(now - 30 * DAY), status: "finalized" }] as any,
      now,
    );
    expect(items.map((t) => t.id)).toEqual(["done"]);
  });

  test("неразбираемая дата — это «не знаю»: элемент скрыт, но НЕ молча", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const items = keepOnlyStillUpcoming([{ id: "broken", startsAt: "не дата", status: "upcoming" }] as any);
    expect(items).toEqual([]);
    // Молчаливое исчезновение элемента — отдельный дефект: снаружи он
    // неотличим от «такого турнира не было».
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.join(" "))).toContain("broken");
    warn.mockRestore();
  });
});

describe("ручка /upcoming целиком", () => {
  test("протухшему ОБРАЗЦУ дата обновляется, и ответ содержит только будущее", async () => {
    // Ровно состояние прода: образец с датой трёхмесячной давности.
    tournaments.push({
      id: "tour_demo_swiss_001",
      startsAt: "2026-05-04T13:37:20.244Z",
      format: "Swiss · 3+2 · 7 rounds",
      prizePool: 250,
      entries: 32,
      capacity: 64,
      status: "upcoming",
    });

    const r = await request(makeApp()).get("/api/cyberchess/upcoming");
    expect(r.status).toBe(200);
    expect(r.body.items).toHaveLength(1);

    const at = Date.parse(r.body.items[0].startsAt);
    expect(Number.isFinite(at)).toBe(true);
    expect(at).toBeGreaterThan(Date.now());
    // Обновление именно ЗАПИСАНО, а не подставлено в ответ: иначе хранилище и
    // ответ расходятся, и следующий читатель снова увидит май.
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(Date.parse(mockSave.mock.calls[0][0].startsAt)).toBeGreaterThan(Date.now());
  });

  test("НАСТОЯЩЕМУ турниру дату не переписывают — его просто не показывают предстоящим", async () => {
    tournaments.push({
      id: "swiss-blitz-friday",
      startsAt: "2026-05-04T13:37:20.244Z",
      format: "Swiss · 3+2 · 7 rounds",
      prizePool: 250,
      entries: 32,
      capacity: 64,
      status: "upcoming",
    });

    const r = await request(makeApp()).get("/api/cyberchess/upcoming");
    expect(r.status).toBe(200);
    expect(r.body.items).toEqual([]);
    // Подделка расписания хуже пустого списка.
    expect(mockSave).not.toHaveBeenCalled();
    expect(tournaments[0].startsAt).toBe("2026-05-04T13:37:20.244Z");
  });

  test("образец, протухший ВТОРОЙ раз, освежается снова", async () => {
    // Тот самый изъян, из-за которого убран флаг «уже сделано»: освежение даёт
    // сутки вперёд, значит через трое суток образец протухает опять. С флагом
    // починка срабатывала один раз за жизнь процесса, и ручка снова начинала
    // врать — молча, без падений и без записи в журнал.
    tournaments.push({
      id: "tour_demo_swiss_001",
      startsAt: "2026-05-04T13:37:20.244Z",
      format: "Swiss · 3+2 · 7 rounds",
      prizePool: 250,
      entries: 32,
      capacity: 64,
      status: "upcoming",
    });
    const app = makeApp();

    const first = await request(app).get("/api/cyberchess/upcoming");
    expect(first.body.items).toHaveLength(1);

    // Проходят сутки: дата снова в прошлом.
    tournaments[0].startsAt = iso(Date.now() - DAY);
    const second = await request(app).get("/api/cyberchess/upcoming");

    expect(second.body.items).toHaveLength(1);
    expect(Date.parse(second.body.items[0].startsAt)).toBeGreaterThan(Date.now());
    expect(mockSave).toHaveBeenCalledTimes(2);
  });

  test("на пустом хранилище посев даёт даты В БУДУЩЕМ, а не от загрузки модуля", async () => {
    const r = await request(makeApp()).get("/api/cyberchess/upcoming");
    expect(r.status).toBe(200);
    expect(r.body.items.length).toBeGreaterThan(0);
    for (const t of r.body.items) {
      expect(Date.parse(t.startsAt)).toBeGreaterThan(Date.now());
    }
  });
});
