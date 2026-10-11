import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express from "express";
import request from "supertest";

/*
 * 🔴 «ДОИГРАЛИ 0» НЕ ГОВОРИТ, НА КАКОМ ХОДУ УШЛИ — ЭТО ГОВОРЯТ КОРЗИНЫ ПОЛУХОДОВ.
 *
 * Замер прода 11.10.2026: на шахматах 10 живых сессий начали партию и НИ ОДНА не
 * доиграла; все три «доигранные» за неделю — наши пробы. Ступень «доиграли»
 * отвечает «нет» и замолкает, а правка продукта зависит от того, уходят на
 * втором ходу или на двадцатом.
 *
 * Разрез `byChessPlies` кладёт сессию в корзину по МАКСИМУМУ полуходов, взятому
 * у любого события с `meta.plies`. Имя события на разрез не влияет — это
 * сознательное решение: окно шахмат ещё не выбрало имя для события обрыва, и
 * привязка к имени потребовала бы второй выкатки бэкенда (а они идут волнами по
 * нескольку дней).
 *
 * Отдельно проверяется ОБЕЩАНИЕ ГОТОВНОСТИ: событие `game_progress` принимается
 * пишущей ручкой УЖЕ СЕЙЧАС. Если бы оно не было в списке принимаемых, первые
 * события клиента отбились бы с 400 и пропали безвозвратно. Поэтому путь в
 * стороже полный: POST → журнал → GET, а не запись в файл руками.
 */
const каталог = mkdtempSync(join(tmpdir(), "aevion-plies-"));
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

/** Сессия, пришедшая на шахматы и дошедшая до числа полуходов. */
function партия(sid: string, полуходы: number | string | null, метка = "yt") {
  const начало = [
    { type: "page_view", ts: сейчас(), sid, path: `/cyberchess?c=${метка}` },
    { type: "feature_use", ts: сейчас(), sid, path: "/cyberchess" },
  ];
  if (полуходы === null) return начало;
  return [
    ...начало,
    { type: "game_end", ts: сейчас(), sid, path: "/cyberchess", meta: { plies: полуходы } },
  ];
}

describe("корзины полуходов показывают, где уходят", () => {
  it("🔴 сессии разложены по корзинам, и корзина названа словами", async () => {
    журнал([
      ...партия("сдался", 0),
      ...партия("один-ход", 2),
      ...партия("дебют", 7),
      ...партия("середина", 15),
      ...партия("всерьёз", 30),
      ...партия("длинная", 60),
    ]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    expect(r.status).toBe(200);
    const к = r.body.byChessPlies;
    expect(к, "разрез не доехал до тела ответа").toBeTruthy();
    expect(к["0 полуходов (ход не сделан)"].сессий).toBe(1);
    expect(к["1–2 полухода"].сессий).toBe(1);
    expect(к["3–10 полуходов"].сессий).toBe(1);
    expect(к["11–20 полуходов"].сессий).toBe(1);
    expect(к["21–40 полуходов"].сессий).toBe(1);
    expect(к["41+ полуходов"].сессий).toBe(1);
    // Порядок корзин — по возрастанию: таблицу читают глазами сверху вниз.
    expect(Object.keys(к)[0]).toMatch(/^0 полуходов/);
    expect(Object.keys(к).at(-1)).toMatch(/^41\+/);
  });

  it("🔴 единица — сессия, и берётся МАКСИМУМ, а не каждое событие", async () => {
    журнал([
      { type: "page_view", ts: сейчас(), sid: "один", path: "/cyberchess?c=yt" },
      { type: "game_end", ts: сейчас(), sid: "один", path: "/cyberchess", meta: { plies: 4 } },
      { type: "game_end", ts: сейчас(), sid: "один", path: "/cyberchess", meta: { plies: 12 } },
      { type: "game_end", ts: сейчас(), sid: "один", path: "/cyberchess", meta: { plies: 9 } },
    ]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    const к = r.body.byChessPlies;
    expect(к["11–20 полуходов"]?.сессий, "максимум не взят").toBe(1);
    expect(к["3–10 полуходов"], "одна сессия попала в две корзины").toBeUndefined();
  });

  it("🔴 наши пробы названы отдельно в каждой корзине", async () => {
    журнал([
      ...партия("наш", 15, "probe-okno"),
      ...партия("живой", 15),
    ]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    const к = r.body.byChessPlies["11–20 полуходов"];
    expect(к.сессий).toBe(2);
    expect(к.сессийНаших, "наша проба не отделена").toBe(1);
    expect(к.сессий - к.сессийНаших, "живых в корзине вышло не столько").toBe(1);
  });

  it("🔴 событие обрыва принимается УЖЕ СЕЙЧАС: POST → журнал → GET", async () => {
    /*
     * Главная проверка готовности. Путь полный: если бы `game_progress` не было
     * в списке принимаемых имён, ручка ответила бы 400, и первые события клиента
     * пропали бы. Сторож, записывающий событие в файл руками, этого не поймал бы
     * — ровно так у нас месяц не работал гостевой вход.
     */
    const app = await приложение();
    const вход = await request(app)
      .post("/api/pricing/events")
      .set("user-agent", UA)
      .send({ type: "page_view", sid: "обрыв", path: "/cyberchess?c=yt" });
    expect(вход.status, "просмотр не принят").toBe(204);

    /*
     * ДВА имени, а не одно. Окно шахмат (user-16) шлёт пороговые события
     * (`game_progress` на границах 1/3/11/21/41) И событие ухода
     * (`game_abandon` по pagehide), потому что pagehide доезжает не всегда.
     * Принимающая сторона обязана знать оба ДО выкатки клиента: сайт и бэкенд
     * едут разными волнами, и если клиент уедет раньше, события отобьются с 400
     * и пропадут безвозвратно — восстановить их нечем.
     */
    for (const имя of ["game_progress", "game_abandon"]) {
      const ответ = await request(app)
        .post("/api/pricing/events")
        .set("user-agent", UA)
        .send({ type: имя, sid: "обрыв", path: "/cyberchess", meta: { plies: 13 } });
      expect(ответ.status, `событие ${имя} ручка не принимает`).toBe(204);
    }

    const r = await request(app).get("/api/pricing/events/funnel?days=1");
    expect(
      r.body.byChessPlies["11–20 полуходов"]?.сессий,
      "принятое событие обрыва не попало в корзины",
    ).toBe(1);

    // И оно же читается ручкой по типам: иначе ступень есть, а спросить нечем.
    const поТипам = await request(app).get(
      "/api/pricing/events/by-type?types=game_progress&days=1",
    );
    expect(поТипам.status).toBe(200);
    expect(поТипам.body.поТипу.game_progress.всего).toBe(1);
  });

  it("🔴 пустые корзины НЕ печатаются, а разрез остаётся в ответе", async () => {
    // Ноль в каждой строке читается как «мерили и не нашли», тогда как правда —
    // «таких сессий не было». А сам ключ обязан быть: его отсутствие означало бы
    // «прод старше правки».
    журнал([...партия("один-ход", 2)]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    expect(Object.keys(r.body.byChessPlies)).toEqual(["1–2 полухода"]);
    журнал([...партия("без-партии", null)]);
    const r2 = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    expect(r2.body.byChessPlies, "разрез пропал из ответа, когда корзины пусты").toEqual({});
  });

  it("КОНТРОЛЬ: сессия без события с числом в корзины не попадает", async () => {
    журнал([...партия("пробовал", null)]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    expect(r.body.byChessPlies).toEqual({});
    // При этом «попробовали» её видит — значит сумма корзин МЕНЬШЕ «попробовали»,
    // и это названная граница разреза, а не потеря.
    expect(r.body.byChannel.yt?.tried ?? r.body.totalBySession.tried).toBeGreaterThanOrEqual(1);
  });

  it("КОНТРОЛЬ: plies строкой — не число ходов, в корзину не идёт", async () => {
    журнал([...партия("строкой", "15")]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    expect(r.body.byChessPlies, "строка принята за число полуходов").toEqual({});
  });
});
