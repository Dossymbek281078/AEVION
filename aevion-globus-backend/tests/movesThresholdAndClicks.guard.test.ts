import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express from "express";
import request from "supertest";

/*
 * 🔴 ДВА РЕШЕНИЯ, КОТОРЫЕ ДОЛЖНЫ ЖИТЬ В ОДНОМ МЕСТЕ.
 *
 * 1. ПОРОГ ХОДОВ. Окно шахмат замерило живой прод: `game_end` уходит даже у
 *    партии из НУЛЯ ходов — «сдался до первого хода», и на экране буквально
 *    «партия ещё не начата». Договорились так: фронт кладёт ФАКТ
 *    (`meta.moves` числом), а решение «что считать доигранной партией» живёт
 *    здесь. Иначе определение окажется в двух местах и разойдётся при первой
 *    правке — это их довод, и он верный.
 *
 *    Порог — один ход. Выше не ставлю: распределения ходов ещё нет, и брать
 *    его с потолка значило бы подогнать число под вкус.
 *
 * 2. СТУПЕНЬ «НАЖАЛИ». В замере 08.10 было 8 живых нажатий за двое суток — и
 *    отнести их было некуда: разрез по каналам `cta_click` не считал, а ручка
 *    по типам не разбивает по каналам. Восемь нажатий существовали, а где —
 *    неизвестно.
 *
 * ⚠️ Импорты модуля только `await import` внутри теста: путь к журналу читается
 * ПРИ ИМПОРТЕ.
 */
const каталог = mkdtempSync(join(tmpdir(), "aevion-moves-"));
const файл = join(каталог, "events.jsonl");
process.env.EVENTS_FILE = файл;

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";
const сейчас = () => new Date().toISOString();
const день = () => new Date().toISOString().slice(0, 10);

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
  app.use("/api/pricing/events", eventsRouter);
  return app;
}

/** Сессия на шахматах: пришла и начала партию. */
function партия(sid: string, конец?: Record<string, unknown>) {
  return [
    { type: "page_view", ts: сейчас(), sid, path: "/cyberchess?c=yt-chess", meta: { channel: "youtube" } },
    { type: "feature_use", ts: сейчас(), sid, path: "/cyberchess", meta: { channel: "youtube" } },
    ...(конец ? [{ ts: сейчас(), sid, path: "/cyberchess", ...конец }] : []),
  ];
}

describe("порог ходов решается в разрезе", () => {
  it("🔴 партия из НУЛЯ ходов не доиграна", async () => {
    журнал(партия("сдался-сразу", { type: "game_end", meta: { channel: "youtube", moves: 0 } }));
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    expect(r.status).toBe(200);
    expect(r.body.byChannel.youtube.tried, "начавшие партию потеряны").toBe(1);
    expect(r.body.byChannel.youtube.finished, "ноль ходов зачтён как доигранная партия").toBe(0);
    expect(r.body.byChannel.youtube.finishedWithoutMoves, "число есть, значит это не «без числа»").toBe(0);
  });

  it("🔴 ОДИН ПОЛУХОД — доиграна: порог стоит на plies, а не на парах", async () => {
    /*
     * Поправка окна шахмат 08.10.2026, снявшая мой дефект: `moves` в событии
     * считается ПАРАМИ (`floor(hist.length/2)`), поэтому партия из одного хода
     * давала `moves = 0`, и мой прежний порог `moves >= 1` отбрасывал её как
     * «не партию» — хотя человек играл. Это решающий случай всей правки.
     */
    журнал(
      партия("один-полуход", {
        type: "game_end",
        meta: { channel: "youtube", plies: 1, moves: 0 },
      }),
    );
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    expect(r.body.byChannel.youtube.finished, "партия из одного полухода отброшена").toBe(1);
    expect(r.body.byChannel.youtube.finishedWithoutMoves).toBe(0);
  });

  it("🔴 ноль полуходов — не партия, даже если поле есть", async () => {
    журнал(
      партия("сдался-до-хода", {
        type: "game_end",
        meta: { channel: "youtube", plies: 0, moves: 0 },
      }),
    );
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    expect(r.body.byChannel.youtube.finished).toBe(0);
    expect(r.body.byChannel.youtube.finishedWithoutMoves).toBe(0);
  });

  it("старое событие БЕЗ plies читается грубой мерой и не теряется", async () => {
    // События, записанные до правки фронта, несут только пары ходов. Запасной
    // путь обязан их прочитать: пара ходов — заведомо не меньше одного полухода.
    журнал(партия("старое", { type: "game_end", meta: { channel: "youtube", moves: 12 } }));
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    expect(r.body.byChannel.youtube.finished).toBe(1);
  });

  it("КОНТРОЛЬ: plies строкой — это «без числа», а не полуход", async () => {
    журнал(
      партия("строкой", { type: "game_end", meta: { channel: "youtube", plies: "1" } }),
    );
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    expect(r.body.byChannel.youtube.finished).toBe(0);
    expect(r.body.byChannel.youtube.finishedWithoutMoves).toBe(1);
  });

  it("🔴 партия из одного хода доиграна — порог именно такой", async () => {
    журнал(партия("один-ход", { type: "game_end", meta: { channel: "youtube", moves: 1 } }));
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    expect(r.body.byChannel.youtube.finished).toBe(1);
  });

  it("🔴 `game_end` БЕЗ числа ходов назван отдельно, а не выброшен и не зачтён", async () => {
    /*
     * Так выглядят все события до правки фронта. Молчание в обе стороны врёт
     * одинаково: зачислишь — «доиграли» обгонит «начали»; выбросишь — события
     * исчезнут без следа, и «0 доигравших» нельзя будет отличить от «не было
     * данных».
     */
    журнал(партия("без-числа", { type: "game_end", meta: { channel: "youtube" } }));
    const app = await приложение();
    const r = await request(app).get("/api/pricing/events/funnel?days=1");
    expect(r.body.byChannel.youtube.finished).toBe(0);
    expect(r.body.byChannel.youtube.finishedWithoutMoves).toBe(1);

    const сводка = await request(app).get(`/api/pricing/events/day?date=${день()}`);
    expect(сводка.body.доиграли.всего).toBe(0);
    expect(
      сводка.body.доиграли.безЧислаХодов,
      "в сводке «0 доиграли» нельзя отличить от «не было числа»",
    ).toBe(1);
  });

  it("КОНТРОЛЬ: строка вместо числа читается как «без числа», а не как ход", async () => {
    // Договорились о числе; строка «1» должна попасть в «без числа», иначе
    // формат события станет негласным и разойдётся с памяткой.
    журнал(партия("строкой", { type: "game_end", meta: { channel: "youtube", moves: "1" } }));
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    expect(r.body.byChannel.youtube.finished).toBe(0);
    expect(r.body.byChannel.youtube.finishedWithoutMoves).toBe(1);
  });

  it("доигравших не больше начавших — неравенство держится и с порогом", async () => {
    журнал([
      ...партия("а", { type: "game_end", meta: { channel: "youtube", moves: 40 } }),
      ...партия("б", { type: "game_end", meta: { channel: "youtube", moves: 0 } }),
      ...партия("в"),
    ]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    const yt = r.body.byChannel.youtube;
    expect(yt.finished).toBeLessThanOrEqual(yt.tried);
    expect(yt.tried).toBe(3);
    expect(yt.finished).toBe(1);
  });
});

describe("ступень «нажали»", () => {
  it("🔴 нажатие видно в канале, странице входа и сводке", async () => {
    журнал([
      { type: "page_view", ts: сейчас(), sid: "нажал", path: "/pricing?c=yt", meta: { channel: "youtube" } },
      { type: "cta_click", ts: сейчас(), sid: "нажал", path: "/pricing", meta: { channel: "youtube" } },
      { type: "page_view", ts: сейчас(), sid: "смотрел", path: "/pricing?c=yt", meta: { channel: "youtube" } },
    ]);
    const app = await приложение();
    const r = await request(app).get("/api/pricing/events/funnel?days=1");
    expect(r.body.byChannel.youtube.clicked, "ступень посчитана, но не отдана").toBe(1);
    expect(r.body.byEntryPage["youtube|/pricing"].нажали).toBe(1);

    const сводка = await request(app).get(`/api/pricing/events/day?date=${день()}`);
    expect(Object.keys(сводка.body)).toContain("нажали");
    expect(сводка.body.нажали).toEqual({ всего: 1, наши: 0, живые: 1 });
  });

  it("единица — сессия: три нажатия одного человека это один", async () => {
    журнал([
      { type: "page_view", ts: сейчас(), sid: "один", path: "/pricing?c=yt", meta: { channel: "youtube" } },
      { type: "cta_click", ts: сейчас(), sid: "один", path: "/pricing", meta: { channel: "youtube" } },
      { type: "cta_click", ts: сейчас(), sid: "один", path: "/pricing", meta: { channel: "youtube" } },
      { type: "cta_click", ts: сейчас(), sid: "один", path: "/pricing", meta: { channel: "youtube" } },
    ]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    expect(r.body.byChannel.youtube.clicked).toBe(1);
  });

  it("наши пробы отделены, иначе свои прогоны станут нажатиями людей", async () => {
    журнал([
      { type: "page_view", ts: сейчас(), sid: "наш", path: "/pricing?c=probe-okno", meta: { channel: "probe-okno" } },
      { type: "cta_click", ts: сейчас(), sid: "наш", path: "/pricing", meta: { channel: "probe-okno" } },
    ]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    const к = r.body.byChannel["probe-okno"];
    expect(к.clicked).toBe(1);
    expect(к.clickedOurs).toBe(1);
    expect(к.clicked - к.clickedOurs, "наша проба ушла в живые нажатия").toBe(0);
  });
});
