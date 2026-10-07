import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express from "express";
import request from "supertest";

/*
 * 🔴 Внешний обходчик ссылок отсеивается — и НИ ОДИН живой человек вместе с ним.
 *
 * Замер 07.10.2026 по публичной ручке за двое суток: у канала youtube 37 постов
 * в разрезе, у 33 из них РОВНО по 2 живых визита (распределение 1:1, 2:33, 3:3),
 * всего 76 визитов, до цен дошёл один. Прирост просмотров роликов за то же
 * время — от +1 до +74, то есть с живым вниманием числа не связаны. Окно 99
 * получило те же числа независимо.
 *
 * Прежние две приметы его не ловили: строка браузера у него человеческая,
 * признак управляемого браузера он не выставляет (`visitsOurs` был 0).
 *
 * Контроли здесь важнее самой находки: признак, отсеивающий живых людей, хуже
 * отсутствия признака. Поэтому отдельными тестами проверено, что НЕ ловятся:
 * человек с одним просмотром, человек, ходивший по сайту, двое людей с
 * одинаковой строкой браузера на одной метке, и наши собственные пробы.
 *
 * ⚠️ Импорты модуля — только `await import` внутри теста: путь к журналу
 * читается ПРИ ИМПОРТЕ (сторож, нарушивший это, был зелёным на чужом журнале).
 */
const каталог = mkdtempSync(join(tmpdir(), "aevion-crawl-"));
const файл = join(каталог, "events.jsonl");
process.env.EVENTS_FILE = файл;

const ЧЕЛОВЕК =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";
const сейчас = Date.now();
const вМинуту = (м: number) => new Date(сейчас - м * 60 * 1000).toISOString();

function журнал(события: Array<Record<string, unknown>>) {
  writeFileSync(файл, события.map((о) => JSON.stringify({ ua: ЧЕЛОВЕК, ...о })).join("\n") + "\n");
}

beforeEach(() => {
  журнал([]);
});

afterAll(() => {
  rmSync(каталог, { recursive: true, force: true });
});

/*
 * ⚠️ Модуль подгружается ОДИН раз до тестов. Первый запрос тащит за собой
 * импорт роутера, и под нагрузкой соседних окон он не укладывался в 30 с —
 * сторож краснел таймаутом, ничего не сказав о предмете. Это не логика, но
 * красный сторож, которому не верят, хуже отсутствующего.
 */
beforeAll(async () => {
  await import("../src/routes/events");
}, 120_000);

async function приложение() {
  const { eventsRouter } = await import("../src/routes/events");
  const app = express();
  app.use("/api/pricing/events", eventsRouter);
  return app;
}

/** Обход: одна строка браузера, много РАЗНЫХ меток, по одному просмотру. */
function обходНаДесятьМеток(): Array<Record<string, unknown>> {
  return Array.from({ length: 10 }, (_, i) => ({
    type: "page_view",
    ts: вМинуту(10 - i * 0.5),
    sid: `обход-${i}`,
    path: `/go?c=yt-rolik${i}`,
    meta: { channel: "youtube", post: `rolik${i}` },
  }));
}

describe("обходчик ссылок отсеян, люди целы", () => {
  it("🔴 десять меток от одной строки браузера за минуты — отсеяны отдельным счётчиком", async () => {
    журнал(обходНаДесятьМеток());
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    expect(r.status).toBe(200);
    expect(r.body.botsExcludedByCrawlPattern, "обходчик не отсеян").toBe(10);
    expect(r.body.total.visits, "обходчик попал в живые визиты").toBe(0);
    // Причина названа словами: число без объяснения прочтут как «роботы вообще».
    expect(r.body.botsExcludedByCrawlPatternWhy).toMatch(/разным меткам/);
  });

  it("🔴 обходчик, НАЖАВШИЙ «купить», тоже отсеян — вместе с его началом оплаты", async () => {
    /*
     * Нашло окно 99, 07.10.2026, живой замер: 8 «начал оплату» на /qmelanin с
     * восьми разных роликов, у каждого ровно 2 визита, 0 до цен, 1 старт,
     * `checkoutStartOurs` ноль. То есть восемь поддельных денежных шагов
     * выглядели живыми покупателями — а это прямой путь к решению тратить
     * деньги на канал, которого нет.
     *
     * Прежнее условие («ровно одно событие в сессии») обходчик обходил, как
     * только нажимал ссылку покупки. Теперь из шаблона выпадает только сессия
     * с признаком ВНИМАНИЯ, а нажатие от него не спасает.
     */
    const события: Array<Record<string, unknown>> = [];
    for (let i = 0; i < 8; i += 1) {
      события.push({
        type: "page_view",
        ts: вМинуту(10 - i * 0.5),
        sid: `обход-куп-${i}`,
        path: `/qmelanin?c=yt-rolik${i}`,
        meta: { channel: "youtube", post: `rolik${i}` },
      });
      события.push({
        type: "checkout_start",
        ts: вМинуту(10 - i * 0.5),
        sid: `обход-куп-${i}`,
        path: "/qmelanin",
        meta: { channel: "youtube", post: `rolik${i}`, app: "qmelanin" },
      });
    }
    журнал(события);

    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    expect(r.status).toBe(200);
    expect(r.body.botsExcludedByCrawlPattern, "обходчик с нажатием не отсеян").toBe(16);
    // Главное: поддельные денежные шаги НЕ попали в живые начала оплаты.
    expect(r.body.byChannel.youtube, "канал появился только из-за обходчика").toBeUndefined();
    expect(r.body.totalBySession.checkoutStart, "поддельные начала оплаты в живых").toBe(0);
  });

  it("🔴 КОНТРОЛЬ: сессия с признаком ЧТЕНИЯ не обходчик, даже внутри шаблона", async () => {
    // Человеку нужен способ отличиться, иначе признак начнёт прятать людей.
    // Этот способ — событие внимания: машина его не шлёт.
    const события: Array<Record<string, unknown>> = [...обходНаДесятьМеток()];
    события.push({
      type: "page_view",
      ts: вМинуту(6),
      sid: "человек-читал",
      path: "/qmelanin?c=yt-rolik3",
      meta: { channel: "youtube" },
    });
    события.push({
      type: "engaged",
      ts: вМинуту(5),
      sid: "человек-читал",
      path: "/qmelanin",
      meta: { channel: "youtube" },
    });
    события.push({
      type: "checkout_start",
      ts: вМинуту(5),
      sid: "человек-читал",
      path: "/qmelanin",
      meta: { channel: "youtube", app: "qmelanin" },
    });
    журнал(события);

    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    expect(r.body.botsExcludedByCrawlPattern).toBe(10);
    expect(r.body.totalBySession.visits, "читавший человек отсеян как обходчик").toBe(1);
    expect(r.body.totalBySession.engaged).toBe(1);
    expect(r.body.totalBySession.checkoutStart, "живое начало оплаты потеряно").toBe(1);
  });

  it("🔴 КОНТРОЛЬ: человек с ОДНИМ просмотром НЕ отсеян", async () => {
    // Самая опасная ошибка такого признака: отсеять тех, кто закрыл страницу
    // сразу. Их поведение совпадает с обходчиком по одному признаку — и только
    // по одному, поэтому одного признака и недостаточно.
    журнал([
      { type: "page_view", ts: вМинуту(5), sid: "человек", path: "/go?c=yt-rolik1", meta: { channel: "youtube" } },
    ]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    expect(r.body.botsExcludedByCrawlPattern).toBe(0);
    expect(r.body.total.visits).toBe(1);
  });

  it("🔴 КОНТРОЛЬ: двое людей с ОДИНАКОВОЙ строкой браузера на одной метке целы", async () => {
    // Строка браузера у людей повторяется постоянно (один Chrome на Windows),
    // поэтому признак обязан требовать РАЗНЫЕ метки, а не просто много сессий.
    журнал([
      { type: "page_view", ts: вМинуту(4), sid: "первый", path: "/go?c=yt-rolik1", meta: { channel: "youtube" } },
      { type: "page_view", ts: вМинуту(3), sid: "второй", path: "/go?c=yt-rolik1", meta: { channel: "youtube" } },
      { type: "page_view", ts: вМинуту(2), sid: "третий", path: "/go?c=yt-rolik1", meta: { channel: "youtube" } },
    ]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    expect(r.body.botsExcludedByCrawlPattern).toBe(0);
    expect(r.body.total.visits).toBe(3);
  });

  it("🔴 КОНТРОЛЬ: наши пробы не превращаются в обходчика", async () => {
    // Наши смоук-прогоны сами ходят по многим страницам и подходят под шаблон.
    // Они уже помечены отдельно, и смешивать два ответа в одном счётчике
    // нельзя: «наше» и «чужая машина» — разные вещи для решений.
    журнал(
      Array.from({ length: 10 }, (_, i) => ({
        type: "page_view",
        ts: вМинуту(10 - i * 0.5),
        sid: `проба-${i}`,
        path: `/go?c=yt-rolik${i}&probe=okno`,
        meta: { channel: "youtube", post: `rolik${i}` },
      })),
    );
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    expect(r.body.botsExcludedByCrawlPattern, "наши пробы посчитаны чужим обходчиком").toBe(0);
    /*
     * 🔴 «Наши» у этой ручки живут в РАЗРЕЗЕ, а не в её итоге, и я на этом
     * оступился, когда писал сторож: `total` у воронки собран из суточного
     * накопителя и поля `visitsOurs` не имеет вовсе (вернулось undefined).
     * Два разных объекта под одним именем `total` — тот самый класс «одна вещь
     * под двумя именами», только наоборот. Поэтому «наше» спрашиваем там, где
     * оно считается: в разрезе по каналу.
     */
    expect(r.body.total.visits).toBe(10);
    expect(r.body.byChannel.youtube.visits).toBe(10);
    expect(r.body.byChannel.youtube.visitsOurs).toBe(10);
    expect(
      r.body.byChannel.youtube.visits - r.body.byChannel.youtube.visitsOurs,
      "наши пробы попали в живые",
    ).toBe(0);

    /*
     * И та же проверка у ВТОРОЙ ручки. Дописано после мутации: снятие
     * оговорки «кроме наших» в сводке дня прошло зелёным, потому что контроль
     * спрашивал только воронку. Признак, поставленный в двух местах, обязан
     * проверяться в двух местах — иначе половина защиты живёт на честном слове.
     */
    const день = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const d = await request(await приложение()).get(`/api/pricing/events/day?date=${день}`);
    expect(d.status).toBe(200);
    expect(d.body.отсеяноПоШаблонуОбхода, "сводка дня объявила наши пробы обходчиком").toBe(0);
    expect(d.body.визиты).toEqual({ всего: 10, наши: 10, живые: 0 });
  });

  it("🔴 КОНТРОЛЬ: много сессий по ОДНОЙ метке — это люди, а не обходчик", async () => {
    /*
     * Этот контроль дописан после мутации: замена «разных меток» на «число
     * сессий» прошла ЗЕЛЁНОЙ, потому что ни один прежний случай не давал
     * восьми сессий сразу. То есть сторож обещал больше, чем проверял.
     *
     * Случай житейский: популярную ссылку открыли восемь человек за четверть
     * часа, и у всех одинаковая строка браузера (Chrome на Windows — самая
     * частая строка в интернете). Отсеять их значило бы объявить роботами
     * ровно тот трафик, за который мы платим и о котором отчитываемся.
     */
    журнал(
      Array.from({ length: 8 }, (_, i) => ({
        type: "page_view",
        ts: вМинуту(12 - i),
        sid: `человек-${i}`,
        path: "/go?c=yt-populyarnyi",
        meta: { channel: "youtube", post: "populyarnyi" },
      })),
    );
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    expect(r.body.botsExcludedByCrawlPattern, "живые люди объявлены обходчиком").toBe(0);
    expect(r.body.total.visits).toBe(8);
  });

  it("КОНТРОЛЬ: сессия с продолжением не обходчик, даже среди обхода", async () => {
    // У обходчика каждая сессия — один просмотр без продолжения. Человек,
    // пришедший по той же метке и пошедший дальше, обязан остаться живым.
    журнал([
      ...обходНаДесятьМеток(),
      { type: "page_view", ts: вМинуту(6), sid: "живой", path: "/go?c=yt-rolik3", meta: { channel: "youtube" } },
      { type: "page_view", ts: вМинуту(5), sid: "живой", path: "/pricing", meta: { channel: "youtube" } },
    ]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    expect(r.body.botsExcludedByCrawlPattern).toBe(10);
    expect(r.body.total.visits, "живой человек отсеян вместе с обходчиком").toBe(1);
    expect(r.body.total.pricing).toBe(1);
  });

  it("сводка дня считает тот же признак, а не молчит", async () => {
    журнал(обходНаДесятьМеток());
    const день = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const r = await request(await приложение()).get(`/api/pricing/events/day?date=${день}`);
    expect(r.status).toBe(200);
    expect(r.body.отсеяноПоШаблонуОбхода, "признак работает в одной ручке и молчит в другой").toBe(
      10,
    );
  });

  it("порог назван числом и объяснён, а не спрятан в коде", async () => {
    const { ОБХОД_МЕТОК_МИНИМУМ, ОБХОД_ОКНО_МС } = await import("../src/routes/events");
    expect(ОБХОД_МЕТОК_МИНИМУМ).toBeGreaterThanOrEqual(5);
    // Запас против наблюдаемого шаблона (33 метки) — не меньше чем вчетверо.
    expect(ОБХОД_МЕТОК_МИНИМУМ).toBeLessThanOrEqual(33 / 4);
    expect(ОБХОД_ОКНО_МС).toBeGreaterThan(60_000);
  });
});
