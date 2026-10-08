import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express from "express";
import request from "supertest";

/*
 * 🔴 «ДОИГРАЛ ПАРТИЮ» И «ОТКРЫЛ ЗАДАЧУ ДНЯ» — СТУПЕНИ, А НЕ СОБЫТИЯ В ЖУРНАЛЕ.
 *
 * Повод 08.10.2026, мой же замер по шахматам: 7 живых сессий, 6 читали, 6
 * начали партию — и НОЛЬ доигравших, ноль открывших задачу дня. События сервер
 * принимал, но ни в одно поле разреза они не попадали, а ручка по типам не
 * различает «ноль» и «нет такой строки». То есть главный вопрос магнита —
 * доходит ли человек до конца партии и возвращается ли на второй день — был
 * неотвечаем по устройству, и ответить на него я смог только сложив числа из
 * двух ручек с РАЗНЫМИ единицами.
 *
 * Здесь проверяется то, о чём просил оркестратор, и ровно теми случаями:
 * повтор события в одной сессии (дедуп), событие от НАШЕГО окна (вычитание),
 * и тело обеих ручек — разрез посчитал ещё не значит сводка отдала.
 *
 * ⚠️ Импорты модуля только `await import` внутри теста: путь к журналу читается
 * ПРИ ИМПОРТЕ (сторож, нарушивший это, был зелёным на чужом журнале).
 */
const каталог = mkdtempSync(join(tmpdir(), "aevion-finish-"));
const файл = join(каталог, "events.jsonl");
process.env.EVENTS_FILE = файл;

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";
const сейчас = () => new Date().toISOString();
const деньАлматы = () => new Date().toISOString().slice(0, 10);

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

/** Живая сессия на шахматах: пришла, читала, начала партию. */
function шахматист(sid: string, extra: Array<Record<string, unknown>> = []) {
  return [
    { type: "page_view", ts: сейчас(), sid, path: "/cyberchess?c=yt-chess-shah", meta: { channel: "youtube", post: "chess-shah" } },
    { type: "engaged", ts: сейчас(), sid, path: "/cyberchess", meta: { channel: "youtube" } },
    { type: "feature_use", ts: сейчас(), sid, path: "/cyberchess", meta: { channel: "youtube" } },
    ...extra.map((о) => ({ ts: сейчас(), sid, path: "/cyberchess", meta: { channel: "youtube" }, ...о })),
  ];
}

describe("ступени «доиграл» и «задача дня»", () => {
  it("🔴 доигравший виден в канале, странице входа и сводке", async () => {
    журнал([
      ...шахматист("доиграл", [{ type: "game_end" }]),
      ...шахматист("ушёл"), // начал и не закончил
    ]);
    const app = await приложение();

    const r = await request(app).get("/api/pricing/events/funnel?days=1");
    expect(r.status).toBe(200);
    const yt = r.body.byChannel.youtube;
    expect(yt.tried, "начавшие партию потеряны").toBe(2);
    expect(yt.finished, "ступень посчитана, но не отдана").toBe(1);
    expect(yt.finishedOurs).toBe(0);
    const вх = r.body.byEntryPage["youtube|/cyberchess"];
    expect(вх.доиграли).toBe(1);
    expect(вх.попробовали).toBe(2);

    const сводка = await request(app).get(`/api/pricing/events/day?date=${деньАлматы()}`);
    expect(Object.keys(сводка.body), "сводка не отдала ступень").toContain("доиграли");
    expect(сводка.body.доиграли).toEqual({ всего: 1, наши: 0, живые: 1 });
  });

  it("🔴 ПОВТОР события в одной сессии даёт ОДНОГО доигравшего", async () => {
    /*
     * Две партии подряд, перезагрузка, две вкладки — событие придёт дважды.
     * Единица ступени СЕССИЯ, поэтому в разрезе должен быть один человек, а не
     * два: иначе «доиграли» легко обгонит «начали партию», и строка станет
     * бессмыслицей.
     */
    журнал(шахматист("дважды", [{ type: "game_end" }, { type: "game_end" }]));
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    expect(r.body.byChannel.youtube.finished, "повтор посчитан дважды").toBe(1);
    expect(r.body.byEntryPage["youtube|/cyberchess"].доиграли).toBe(1);
    // И контроль смысла: доигравших не больше начавших.
    expect(r.body.byChannel.youtube.finished).toBeLessThanOrEqual(r.body.byChannel.youtube.tried);
  });

  it("🔴 доигравшее НАШЕ окно вычитается из живого числа", async () => {
    журнал([
      { type: "page_view", ts: сейчас(), sid: "наш", path: "/cyberchess?c=probe-okno", meta: { channel: "probe-okno" } },
      { type: "feature_use", ts: сейчас(), sid: "наш", path: "/cyberchess", meta: { channel: "probe-okno" } },
      { type: "game_end", ts: сейчас(), sid: "наш", path: "/cyberchess", meta: { channel: "probe-okno" } },
      { type: "daily_open", ts: сейчас(), sid: "наш", path: "/cyberchess", meta: { channel: "probe-okno" } },
    ]);
    const app = await приложение();
    const r = await request(app).get("/api/pricing/events/funnel?days=1");
    const к = r.body.byChannel["probe-okno"];
    expect(к.finished).toBe(1);
    expect(к.finishedOurs, "наша проба не помечена нашей").toBe(1);
    expect(к.finished - к.finishedOurs, "наша проба ушла в живое число").toBe(0);
    expect(к.dailyOpened - к.dailyOpenedOurs).toBe(0);

    const сводка = await request(app).get(`/api/pricing/events/day?date=${деньАлматы()}`);
    expect(сводка.body.доиграли.живые).toBe(0);
    expect(сводка.body.задачаДня.живые).toBe(0);
  });

  it("🔴 задача дня — отдельная ступень: её открывают НЕ те, кто доиграл", async () => {
    // Это и есть вопрос возврата на второй день: механизм отдельный, и мерить
    // его надо отдельно, иначе «доиграл» и «вернулся» склеятся в одно число.
    журнал([
      ...шахматист("доиграл-без-задачи", [{ type: "game_end" }]),
      ...шахматист("задача-без-партии", [{ type: "daily_open" }]),
    ]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    const yt = r.body.byChannel.youtube;
    expect(yt.finished).toBe(1);
    expect(yt.dailyOpened).toBe(1);
    const вх = r.body.byEntryPage["youtube|/cyberchess"];
    expect(вх.доиграли).toBe(1);
    expect(вх.задачаДня).toBe(1);
  });

  it("КОНТРОЛЬ: сессия без этих событий даёт НОЛЬ при живых соседних ступенях", async () => {
    // Честный ноль: прибор работает, просто события не было. Ровно это и
    // показал живой замер по шахматам — 6 начали, 0 доиграли.
    журнал(шахматист("только-начал"));
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    const yt = r.body.byChannel.youtube;
    expect(yt.tried).toBe(1);
    expect(yt.engaged).toBe(1);
    expect(yt.finished).toBe(0);
    expect(yt.dailyOpened).toBe(0);
  });
});
