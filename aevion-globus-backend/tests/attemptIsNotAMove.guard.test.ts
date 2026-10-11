import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express from "express";
import request from "supertest";

/*
 * 🔴 НЕВЕРНАЯ ПОПЫТКА — НЕ ХОД. СТУПЕНЬ «ДОШЁЛ ДО ПОРОГА» ЕЁ БОЛЬШЕ НЕ СЧИТАЕТ.
 *
 * Нашло окно 37 замером ЖИВОГО пути на проде 12.10.2026 (перехват тел событий,
 * не чтение кода). Состав событий при НЕВЕРНОМ ходе:
 *
 *   game_progress  meta: plies 1, moves 0, attempts 1, отПопытки true
 *
 * То есть страница шлёт тот же `game_progress`, что и на настоящий ход, и даже
 * с `plies: 1` — иначе сессия не попала бы в корзины полуходов вовсе. Рядом она
 * честно везёт признак `отПопытки`, и в её коде прямо написано, зачем: «чтобы
 * это не превратилось в тихую ложь».
 *
 * Мой читатель признак ИГНОРИРОВАЛ. Последствие денежное, а не косметическое:
 * ступень «дошёл до порога» считала успехом того, кто ткнул не туда, то есть
 * число было завышено В НАШУ ПОЛЬЗУ. Единственный живой «порог» за 11.10 мог
 * быть именно такой попыткой — а на этом числе строился вывод «человек играет».
 *
 * Та же ошибка была в корзинах полуходов: сессия без хода попадала в «1–2
 * полухода» рядом с теми, кто ход сделал, и корзины отвечали на вопрос «где
 * бросили» неверно.
 *
 * Вычтенное НЕ СПРЯТАНО: оно названо полем `attemptWithoutMove`, и
 * `progressed + attemptWithoutMove` даёт прежнее число — иначе падение
 * `progressed` прочли бы как «людей стало меньше».
 */
const каталог = mkdtempSync(join(tmpdir(), "aevion-attempt-"));
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

/** Событие рубежа ровно в том виде, в каком его шлёт страница. */
function рубеж(sid: string, полуходов: number, попыток: number) {
  const отПопытки = полуходов === 0 && попыток > 0;
  return {
    type: "game_progress",
    ts: сейчас(),
    sid,
    path: "/cyberchess",
    meta: {
      channel: "youtube",
      post: "komm-mat3",
      plies: отПопытки ? 1 : полуходов,
      moves: Math.floor(полуходов / 2),
      attempts: попыток,
      отПопытки,
    },
  };
}

async function разрез() {
  const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
  expect(r.status).toBe(200);
  return { тело: r.body, пост: r.body.byPost["youtube/komm-mat3"], канал: r.body.byChannel.youtube };
}

describe("попытка без хода не считается порогом", () => {
  it("🔴 только попытка: порог 0, и число НАЗВАНО отдельно", async () => {
    журнал([вход("ткнул"), рубеж("ткнул", 0, 1)]);
    const { пост, канал, тело } = await разрез();
    expect(пост.progressed, "неверная попытка зачтена ходом").toBe(0);
    expect(пост.attemptWithoutMove, "попытка не названа отдельным числом").toBe(1);
    expect(канал.progressed).toBe(0);
    expect(канал.attemptWithoutMove).toBe(1);
    expect(тело.totalBySession.progressed).toBe(0);
    expect(тело.totalBySession.attemptWithoutMove).toBe(1);
  });

  it("🔴 настоящий ход по-прежнему порог", async () => {
    // Контроль в обратную сторону: если бы я вычел слишком много, ступень
    // перестала бы считать вообще кого-либо, и это выглядело бы «починкой».
    журнал([вход("сыграл"), рубеж("сыграл", 1, 1)]);
    const { пост } = await разрез();
    expect(пост.progressed, "настоящий ход перестал считаться порогом").toBe(1);
    expect(пост.attemptWithoutMove).toBe(0);
  });

  it("🔴 попытка И ход в одной сессии: оба числа по единице", async () => {
    // Человек сперва ткнул не туда, потом сыграл. Он И ошибся, И дошёл —
    // прятать одно ради другого значило бы снова терять половину правды.
    журнал([вход("исправился"), рубеж("исправился", 0, 1), рубеж("исправился", 3, 2)]);
    const { пост } = await разрез();
    expect(пост.progressed).toBe(1);
    expect(пост.attemptWithoutMove).toBe(1);
  });

  it("🔴 прежнее число восстановимо: progressed + attemptWithoutMove", async () => {
    журнал([
      вход("ткнул"),
      рубеж("ткнул", 0, 1),
      вход("сыграл"),
      рубеж("сыграл", 5, 1),
      вход("ещё-ткнул"),
      рубеж("ещё-ткнул", 0, 3),
    ]);
    const { пост } = await разрез();
    expect(пост.progressed).toBe(1);
    expect(пост.attemptWithoutMove).toBe(2);
    expect(
      пост.progressed + пост.attemptWithoutMove,
      "прежнее число не восстанавливается — читатель не поймёт, почему порог упал",
    ).toBe(3);
  });

  it("🔴 корзины полуходов: попытка — это НОЛЬ, а не первый ход", async () => {
    журнал([вход("ткнул"), рубеж("ткнул", 0, 1)]);
    const { тело } = await разрез();
    expect(
      тело.byChessPlies["1–2 полухода"],
      "сессия без хода попала в корзину «1–2 полухода»",
    ).toBeUndefined();
    expect(тело.byChessPlies, "попытка создала корзину").toEqual({});
  });

  it("🔴 корзина берёт максимум по НАСТОЯЩИМ ходам", async () => {
    журнал([вход("оба"), рубеж("оба", 0, 1), рубеж("оба", 7, 2)]);
    const { тело } = await разрез();
    expect(тело.byChessPlies["3–10 полуходов"]?.сессий, "максимум взят не по ходам").toBe(1);
    expect(тело.byChessPlies["1–2 полухода"], "попытка создала вторую корзину").toBeUndefined();
  });

  it("наши пробы отделены и в новом числе", async () => {
    журнал([вход("наш", true), рубеж("наш", 0, 1), вход("живой"), рубеж("живой", 0, 1)]);
    const { пост } = await разрез();
    expect(пост.attemptWithoutMove).toBe(2);
    expect(пост.attemptWithoutMoveOurs, "наша проба не отделена").toBe(1);
    expect(пост.attemptWithoutMove - пост.attemptWithoutMoveOurs).toBe(1);
  });

  it("КОНТРОЛЬ: признак читается именно как true, а не «похоже на true»", async () => {
    /*
     * Строка «true» и единица — не признак. Иначе чужой клиент, пославший
     * `отПопытки: "true"`, молча выключил бы ступень порога целиком.
     */
    журнал([
      вход("строкой"),
      {
        type: "game_progress",
        ts: сейчас(),
        sid: "строкой",
        path: "/cyberchess",
        meta: { channel: "youtube", post: "komm-mat3", plies: 1, отПопытки: "true" },
      },
    ]);
    const { пост } = await разрез();
    expect(пост.progressed, "строка «true» выключила ступень порога").toBe(1);
    expect(пост.attemptWithoutMove).toBe(0);
  });

  it("🔴 объяснение, почему число уменьшилось, стоит В ОТВЕТЕ", async () => {
    журнал([вход("ткнул"), рубеж("ткнул", 0, 1)]);
    const { тело } = await разрез();
    expect(String(тело.progressedNote)).toMatch(/СДЕЛАН ход/);
    expect(String(тело.progressedNote)).toMatch(/отПопытки/);
    expect(String(тело.progressedNote)).toMatch(/attemptWithoutMove/);
    expect(String(тело.progressedNote), "не сказано, что прежнее число восстановимо").toMatch(
      /даёт прежнее число/,
    );
  });
});
