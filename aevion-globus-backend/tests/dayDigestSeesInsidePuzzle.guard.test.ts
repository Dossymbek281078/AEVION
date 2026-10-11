import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express from "express";
import request from "supertest";
import { сегодняАлматы } from "./helpers/суткиАлматы";

/*
 * 🔴 СВОДКА ДНЯ ВИДИТ, ЧТО ПРОИСХОДИТ ВНУТРИ ЗАДАЧИ.
 *
 * До 12.10.2026 сводка дня знала только «дошли по порогу» и «решили задачу»,
 * поэтому «ткнул не туда и ушёл» был в ней неотличим от «начал решать». Три
 * события внутри задачи (замер окна 16) и признак `отПопытки` (замер окна 37)
 * уже читались в разрезах по постам и каналам, а в сводке дня — нет. Сводку дня
 * читает оркестратор в отчёте, то есть именно её числа доходят до основателя.
 *
 * Дата берётся общим помощником `сегодняАлматы`, а НЕ `new Date()...`: ручка
 * `/day` режет сутки по Алматы, и в ночь 11→12.10 двенадцать проверок в семи
 * сторожах падали ровно из-за этой разницы с 00:00 до 05:00.
 */
const каталог = mkdtempSync(join(tmpdir(), "aevion-day-inside-"));
const файл = join(каталог, "events.jsonl");
process.env.EVENTS_FILE = файл;

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";
const сейчас = () => new Date().toISOString();

function журнал(события: Array<Record<string, unknown>>) {
  writeFileSync(файл, события.map((о) => JSON.stringify({ ua: UA, ...о })).join("\n") + "\n");
}

beforeAll(async () => {
  await import("../src/routes/events");
}, 120_000);

beforeEach(() => {
  журнал([]);
});

afterAll(() => {
  rmSync(каталог, { recursive: true, force: true });
});

async function приложение() {
  const { eventsRouter } = await import("../src/routes/events");
  const app = express();
  app.use(express.json());
  app.use("/api/pricing/events", eventsRouter);
  return app;
}

function вход(sid: string, наш = false) {
  return {
    type: "page_view",
    ts: сейчас(),
    sid,
    path: наш ? "/cyberchess?c=yt&probe=okno" : "/cyberchess?c=yt",
    meta: { channel: "youtube", post: "komm-mat3" },
  };
}

function событие(sid: string, тип: string, meta: Record<string, unknown> = {}) {
  return { type: тип, ts: сейчас(), sid, path: "/cyberchess", meta: { channel: "youtube", ...meta } };
}

async function сводка() {
  const r = await request(await приложение()).get(
    `/api/pricing/events/day?date=${сегодняАлматы()}`,
  );
  expect(r.status).toBe(200);
  expect(r.body.дата, "ручка ответила про другой день").toBe(сегодняАлматы());
  return r.body;
}

describe("сводка дня видит шаги внутри задачи", () => {
  it("🔴 пять новых ступеней есть, каждая тремя числами", async () => {
    журнал([
      вход("живой"),
      событие("живой", "puzzle_wrong_move", { попытка: 1 }),
      событие("живой", "puzzle_hint"),
      событие("живой", "puzzle_abandon"),
      событие("живой", "game_progress", { plies: 1, moves: 0, attempts: 1, отПопытки: true }),
      событие("живой", "waitlist_offer_shown", { plies: 1, attempts: 1, отПопытки: true }),
      вход("наш", true),
      событие("наш", "puzzle_wrong_move", { попытка: 1 }),
      событие("наш", "puzzle_hint"),
      событие("наш", "puzzle_abandon"),
      событие("наш", "game_progress", { plies: 1, moves: 0, attempts: 1, отПопытки: true }),
      событие("наш", "waitlist_offer_shown", { plies: 1, attempts: 1, отПопытки: true }),
    ]);
    const с = await сводка();
    for (const имя of [
      "ошиблисьВЗадаче",
      "взялиПодсказку",
      "бросилиЗадачу",
      "толькоПопытка",
      "показПослеПопытки",
    ]) {
      expect(с[имя], `ступени ${имя} в сводке дня нет`).toBeTruthy();
      expect(с[имя].всего, `у ${имя} неверное «всего»`).toBe(2);
      expect(с[имя].наши, `у ${имя} не отделены наши`).toBe(1);
      expect(с[имя].живые, `у ${имя} живое число посчитано неверно`).toBe(1);
    }
  });

  it("🔴 попытка НЕ попала в «дошли по порогу», и сумма восстанавливает прежнее", async () => {
    журнал([
      вход("ткнул"),
      событие("ткнул", "game_progress", { plies: 1, moves: 0, attempts: 1, отПопытки: true }),
      вход("сыграл"),
      событие("сыграл", "game_progress", { plies: 3, moves: 1, attempts: 1, отПопытки: false }),
    ]);
    const с = await сводка();
    expect(с.дошлиПоПорогу.всего, "попытка зачтена ходом").toBe(1);
    expect(с.толькоПопытка.всего).toBe(1);
    expect(
      с.дошлиПоПорогу.всего + с.толькоПопытка.всего,
      "прежнее число не восстанавливается",
    ).toBe(2);
  });

  it("🔴 «показали адрес» при этом НЕ уменьшается", async () => {
    журнал([
      вход("ошибся"),
      событие("ошибся", "waitlist_offer_shown", { plies: 1, attempts: 1, отПопытки: true }),
    ]);
    const с = await сводка();
    expect(с.показалиАдрес.всего, "показ вычтен — число стало меньше правды").toBe(1);
    expect(с.показПослеПопытки.всего).toBe(1);
  });

  it("КОНТРОЛЬ: без этих событий ступени — нули, а не отсутствие полей", async () => {
    журнал([вход("просто-зашёл")]);
    const с = await сводка();
    for (const имя of ["ошиблисьВЗадаче", "взялиПодсказку", "бросилиЗадачу", "толькоПопытка"]) {
      expect(typeof с[имя]?.всего, `поля ${имя} нет вовсе`).toBe("number");
      expect(с[имя].всего).toBe(0);
      expect(с[имя].живые).toBe(0);
    }
  });

  it("🔴 подпись называет ОБРАТНЫЙ смысл трёх ступеней", async () => {
    // Иначе «ошиблись 7» прочтут как «семь человек решают».
    журнал([вход("живой"), событие("живой", "puzzle_hint")]);
    const с = await сводка();
    expect(String(с.единицы)).toMatch(/шаги НАЗАД/);
    expect(String(с.единицы)).toMatch(/ВЫЧТЕНЫ из дошлиПоПорогу/);
    expect(String(с.единицы), "не сказано, что показалиАдрес не уменьшается").toMatch(
      /не уменьшается/,
    );
  });
});
