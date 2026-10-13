import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { denPoMestnomu } from "../src/lib/denPoMestnomu";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express from "express";
import request from "supertest";

/*
 * 🔴 СУТОЧНЫЙ РАЗРЕЗ ЗНАЕТ НОВЫЕ СТУПЕНИ — ИНАЧЕ ИХ НЕЛЬЗЯ СРАВНИТЬ ПО ДНЯМ.
 *
 * Нашло окно fd (10.10.2026): «доиграли», «нажали» и «задача дня» были в
 * разрезах по каналу и по странице входа и в сводке дня, а в byDay их не было
 * вовсе — 0 из 8 дней. То есть на вопрос «стало лучше или хуже после правки»
 * ответить было нечем, а именно его и задают, правя продукт. Шахматам это нужно
 * прямо сейчас: окно 3d разбирает «42 открыли, 0 доиграли» и без дней не видит,
 * когда ступень оборвалась.
 *
 * Сторож делает ЗАПРОС к ручке и читает ТЕЛО ответа: вычисление, не доехавшее
 * до res.json, у нас уже случалось трижды (byPost, byEntryPage, byUnknownTag),
 * и проверка функции такой дефект пропускает.
 *
 * ⚠️ Метки времени считаются ОТ «СЕЙЧАС», а не от календарной даты: окно ручки
 * скользящее (Date.now() минус дней*24ч). Две точки разнесены на 26 часов —
 * тогда они гарантированно в РАЗНЫХ сутках UTC при любом времени запуска.
 *
 * ⚠️ Сутки здесь UTC — такие же, как у визитов в этом же разрезе. Сводка /day
 * считает сутки Алматы. Это не починено намеренно: сдвиг границы изменил бы
 * числа визитов, которые читают соседние окна, и такую правку делают отдельно и
 * объявив. Здесь проверяется только то, что ответ НАЗЫВАЕТ свою ось — иначе два
 * честных числа снова прочтут как расхождение.
 */
const каталог = mkdtempSync(join(tmpdir(), "aevion-byday-"));
const файл = join(каталог, "events.jsonl");
process.env.EVENTS_FILE = файл;

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";

const ЧАС = 60 * 60 * 1000;
const тСегодня = new Date(Date.now() - ЧАС).toISOString();
const тВчера = new Date(Date.now() - 26 * ЧАС).toISOString();
const дСегодня = denPoMestnomu(new Date(тСегодня));
const дВчера = denPoMestnomu(new Date(тВчера));

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

/** Строка нужного дня из тела ответа; «нет строки» — отдельный исход. */
function день(тело: any, дата: string) {
  const строка = (тело.byDay || []).find((д: any) => д.day === дата);
  expect(строка, "в ответе нет строки за " + дата).toBeTruthy();
  return строка;
}

describe("byDay знает ступени «доиграли», «нажали», «задача дня»", () => {
  it("🔴 три ступени есть в ТЕЛЕ ответа и считаются по сессиям", async () => {
    журнал([
      { type: "page_view", ts: тСегодня, sid: "ч1", path: "/cyberchess?c=yt" },
      { type: "cta_click", ts: тСегодня, sid: "ч1", path: "/cyberchess" },
      { type: "daily_open", ts: тСегодня, sid: "ч1", path: "/cyberchess" },
      { type: "game_end", ts: тСегодня, sid: "ч1", path: "/cyberchess", meta: { plies: 24 } },
      { type: "page_view", ts: тСегодня, sid: "ч2", path: "/cyberchess?c=yt" },
      { type: "cta_click", ts: тСегодня, sid: "ч2", path: "/cyberchess" },
    ]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=3");
    expect(r.status).toBe(200);
    const д = день(r.body, дСегодня);
    expect(д.clicked, "ступень «нажали» не доехала до byDay").toBe(2);
    expect(д.finished, "ступень «доиграли» не доехала до byDay").toBe(1);
    expect(д.dailyOpened, "ступень «задача дня» не доехала до byDay").toBe(1);
    expect(д.clickedOurs).toBe(0);
    expect(д.finishedOurs).toBe(0);
    expect(д.dailyOpenedOurs).toBe(0);
  });

  it("🔴 ПОВТОР в одной сессии даёт ОДНОГО — единица сессия, а не событие", async () => {
    /*
     * Класс, на котором мы уже горели: 16 сторожей воронки пропустили обход
     * дедупа, потому что у них все события были из РАЗНЫХ сессий, и проверка
     * утверждала сложение, а не единицу.
     */
    журнал([
      { type: "page_view", ts: тСегодня, sid: "один", path: "/cyberchess?c=yt" },
      { type: "cta_click", ts: тСегодня, sid: "один", path: "/cyberchess" },
      { type: "cta_click", ts: тСегодня, sid: "один", path: "/cyberchess" },
      { type: "cta_click", ts: тСегодня, sid: "один", path: "/pricing" },
      { type: "daily_open", ts: тСегодня, sid: "один", path: "/cyberchess" },
      { type: "daily_open", ts: тСегодня, sid: "один", path: "/cyberchess" },
      { type: "game_end", ts: тСегодня, sid: "один", path: "/cyberchess", meta: { plies: 5 } },
      { type: "game_end", ts: тСегодня, sid: "один", path: "/cyberchess", meta: { plies: 31 } },
    ]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=3");
    const д = день(r.body, дСегодня);
    expect(д.clicked, "три нажатия одного человека сложились").toBe(1);
    expect(д.dailyOpened).toBe(1);
    expect(д.finished, "две партии одного человека сложились").toBe(1);
  });

  it("🔴 наши пробы названы отдельно — иначе свои прогоны станут людьми", async () => {
    журнал([
      { type: "page_view", ts: тСегодня, sid: "наш", path: "/cyberchess?c=probe-okno" },
      { type: "cta_click", ts: тСегодня, sid: "наш", path: "/cyberchess" },
      { type: "daily_open", ts: тСегодня, sid: "наш", path: "/cyberchess" },
      { type: "game_end", ts: тСегодня, sid: "наш", path: "/cyberchess", meta: { plies: 9 } },
      { type: "page_view", ts: тСегодня, sid: "живой", path: "/cyberchess?c=yt" },
      { type: "cta_click", ts: тСегодня, sid: "живой", path: "/cyberchess" },
    ]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=3");
    const д = день(r.body, дСегодня);
    expect(д.clicked).toBe(2);
    expect(д.clickedOurs, "наша проба не отделена").toBe(1);
    expect(д.clicked - д.clickedOurs, "живых нажатий осталось не столько").toBe(1);
    expect(д.finished).toBe(1);
    expect(д.finishedOurs).toBe(1);
    expect(д.finished - д.finishedOurs, "наша партия зачтена живому").toBe(0);
    expect(д.dailyOpened - д.dailyOpenedOurs).toBe(0);
  });

  it("🔴 порог доигранной партии ТОТ ЖЕ, что в разрезе по каналам", async () => {
    /*
     * Якорь ВНЕ суточного разреза: если порог разъедется, два числа для одной
     * вещи разойдутся — ровно то, чего мы избегали, оставив определение в одном
     * месте. Ноль полуходов («сдался до первого хода») партией не считается.
     */
    журнал([
      {
        type: "page_view",
        ts: тСегодня,
        sid: "сдался",
        path: "/cyberchess?c=yt",
        meta: { channel: "youtube" },
      },
      {
        type: "game_end",
        ts: тСегодня,
        sid: "сдался",
        path: "/cyberchess",
        meta: { channel: "youtube", plies: 0 },
      },
      {
        type: "page_view",
        ts: тСегодня,
        sid: "играл",
        path: "/cyberchess?c=yt",
        meta: { channel: "youtube" },
      },
      {
        type: "game_end",
        ts: тСегодня,
        sid: "играл",
        path: "/cyberchess",
        meta: { channel: "youtube", plies: 1 },
      },
    ]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=3");
    const д = день(r.body, дСегодня);
    expect(д.finished, "ноль полуходов зачтён доигранной партией").toBe(1);
    expect(r.body.byChannel.youtube.finished, "разрезы разошлись в пороге").toBe(д.finished);
  });

  it("🔴 ступени видны ПО ДНЯМ отдельно, а не одной суммой", async () => {
    журнал([
      { type: "page_view", ts: тВчера, sid: "вч", path: "/cyberchess?c=yt" },
      { type: "cta_click", ts: тВчера, sid: "вч", path: "/cyberchess" },
      { type: "game_end", ts: тВчера, sid: "вч", path: "/cyberchess", meta: { plies: 12 } },
      { type: "page_view", ts: тСегодня, sid: "сг", path: "/cyberchess?c=yt" },
      { type: "daily_open", ts: тСегодня, sid: "сг", path: "/cyberchess" },
    ]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=3");
    const вчера = день(r.body, дВчера);
    const сегодня = день(r.body, дСегодня);
    expect(вчера.clicked).toBe(1);
    expect(вчера.finished).toBe(1);
    expect(вчера.dailyOpened).toBe(0);
    expect(сегодня.clicked).toBe(0);
    expect(сегодня.finished).toBe(0);
    expect(сегодня.dailyOpened).toBe(1);
  });

  it("КОНТРОЛЬ: день без таких событий печатает НОЛЬ, а не теряет поля", async () => {
    // «Поля нет» и «ноль» читаются по-разному: первое значит «прод старше
    // правки», второе — «людей не было». Отличать их обязано тело ответа.
    журнал([{ type: "page_view", ts: тСегодня, sid: "тихий", path: "/" }]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=3");
    const д = день(r.body, дСегодня);
    for (const поле of [
      "finished",
      "finishedOurs",
      "clicked",
      "clickedOurs",
      "dailyOpened",
      "dailyOpenedOurs",
    ]) {
      expect(д[поле], "поля " + поле + " нет в строке дня").toBe(0);
    }
  });

  it("🔴 ось суточного разреза НАЗВАНА в ответе (единица и граница суток)", async () => {
    журнал([{ type: "page_view", ts: тСегодня, sid: "с", path: "/" }]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=3");
    expect(typeof r.body.byDayUnits, "у byDay нет подписи единиц").toBe("string");
    expect(r.body.byDayUnits).toMatch(/сесси/);
    // С волны 109 (13.10.2026) сутки byDay — по Алматы, как у сводки /day; подпись и поле
    // обязаны это называть, иначе читатель сложит дни по старой шкале.
    expect(r.body.byDayUnits, "не сказано, по какой зоне режутся сутки").toMatch(/Алматы/);
    expect(r.body.byDayUnits, "подпись всё ещё обещает UTC-сутки").not.toMatch(/режутся по UTC/);
    expect(r.body.byDayTimezone, "поля byDayTimezone нет — bd ставит по нему засечку в докладах").toBe("Asia/Almaty");
  });

  it("🔴 событие в 20:30 UTC лежит в СЛЕДУЮЩЕМ дне по Алматы (01:30), а не во вчерашнем", async () => {
    // 2026-10-12T20:30Z = 13.10 01:30 Алматы. До волны 109 такое событие ложилось в 12.10.
    const т = "2026-10-12T20:30:00.000Z";
    журнал([{ type: "page_view", ts: т, sid: "ночной", path: "/cyberchess?c=yt" }]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=400");
    const по = (д: string) => (r.body.byDay as Array<{ day: string; visits: number }>).find((x) => x.day === д);
    expect(по("2026-10-13")?.visits, "визит не попал в 13.10 по Алматы").toBe(1);
    expect(по("2026-10-12")?.visits ?? 0, "визит остался во вчерашнем UTC-дне").toBe(0);
  });
});
