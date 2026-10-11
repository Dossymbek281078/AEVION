import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express from "express";
import request from "supertest";
import { сегодняАлматы } from "./helpers/суткиАлматы";

/*
 * 🔴 ЧЕТЫРЕ СТУПЕНИ ПОЛУЧИЛИ ПУБЛИЧНОГО ЧИТАТЕЛЯ (задание оркестратора 11.10.2026).
 *
 * `waitlist_offer_shown`, `waitlist_submit`, `puzzle_solved` и `game_progress`
 * писались в журнал и лежали там, а прочитать их можно было только закрытой
 * ручкой под админским токеном — то есть ни одно окно их не видело. Это тот же
 * класс «посчитал и не отдал», только начинается он раньше: событие есть, а
 * ступени нет вовсе.
 *
 * Зачем именно эти четыре: пара «показали форму адреса → оставили адрес»
 * отвечает, виновата ли форма или предложение; «решили задачу» — доведённое до
 * конца действие (а не просто «открыл»); «дошли до порога» показывает, что
 * человек играл, даже если партию не закончил.
 *
 * Сторож идёт ПОЛНЫМ путём: POST к пишущей ручке → журнал → GET воронки и
 * сводки дня. Проверка функции тут бесполезна: все четыре имени должны ещё и
 * ПРИНИМАТЬСЯ, а именно этого им однажды и не хватало.
 */
const каталог = mkdtempSync(join(tmpdir(), "aevion-four-steps-"));
const файл = join(каталог, "events.jsonl");
process.env.EVENTS_FILE = файл;

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";
const сейчас = () => new Date().toISOString();
const сегодня = () => сегодняАлматы();

const ИМЕНА = ["waitlist_offer_shown", "waitlist_submit", "puzzle_solved", "game_progress"] as const;

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

function событие(sid: string, type: string, наш = false) {
  return {
    type,
    ts: сейчас(),
    sid,
    path: наш ? "/cyberchess?c=yt&probe=okno" : "/cyberchess?c=yt",
    meta: { channel: "youtube" },
  };
}

describe("четыре ступени видны публично", () => {
  it("🔴 все четыре имени ПРИНИМАЮТСЯ пишущей ручкой", async () => {
    const app = await приложение();
    for (const имя of ИМЕНА) {
      const r = await request(app)
        .post("/api/pricing/events")
        .set("user-agent", UA)
        .send({ type: имя, sid: "принят", path: "/cyberchess" });
      expect(r.status, `имя ${имя} ручка не принимает`).toBe(204);
    }
    // КОНТРОЛЬ прибора: выдуманное имя обязано отбиваться, иначе проверка выше
    // ничего не значит — она бы прошла на любом наборе слов.
    const выдуманное = await request(app)
      .post("/api/pricing/events")
      .set("user-agent", UA)
      .send({ type: "waitlist_offer_shown_vydumannoe", sid: "принят", path: "/cyberchess" });
    expect(выдуманное.status, "ручка принимает что угодно — контроль не сработал").toBe(400);
  });

  it("🔴 ступени видны в разрезе страниц входа, всего/наши", async () => {
    журнал([
      событие("живой", "page_view"),
      событие("живой", "waitlist_offer_shown"),
      событие("живой", "waitlist_submit"),
      событие("живой", "puzzle_solved"),
      событие("живой", "game_progress"),
      // Наша проба внутри того же живого канала: её надо вычитать.
      событие("наш", "page_view", true),
      событие("наш", "waitlist_offer_shown", true),
      событие("наш", "puzzle_solved", true),
      // Человек, которому форму показали, а адрес он не оставил.
      событие("видел-форму", "page_view"),
      событие("видел-форму", "waitlist_offer_shown"),
    ]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    expect(r.status).toBe(200);
    const с = r.body.byEntryPage["youtube|/cyberchess"];
    expect(с, "строки разреза нет").toBeTruthy();

    expect(с.показалиАдрес).toBe(3);
    expect(с.показалиАдресНаших).toBe(1);
    expect(с.оставилиАдрес).toBe(1);
    expect(с.оставилиАдресНаших).toBe(0);
    expect(с.решилиЗадачу).toBe(2);
    expect(с.решилиЗадачуНаших).toBe(1);
    expect(с.дошлиПоПорогу).toBe(1);
    expect(с.дошлиПоПорогуНаших).toBe(0);

    // Главный смысл пары: живых «показали» 2, живых «оставили» 1 — значит
    // половина увидевших форму адрес не оставила, и это видно без переписки.
    expect(с.показалиАдрес - с.показалиАдресНаших).toBe(2);
    expect(с.оставилиАдрес - с.оставилиАдресНаших).toBe(1);
  });

  it("🔴 те же четыре ступени есть в сводке дня", async () => {
    журнал([
      событие("живой", "page_view"),
      событие("живой", "waitlist_offer_shown"),
      событие("живой", "waitlist_submit"),
      событие("наш", "page_view", true),
      событие("наш", "puzzle_solved", true),
      событие("второй", "page_view"),
      событие("второй", "game_progress"),
    ]);
    const сводка = await request(await приложение()).get(
      `/api/pricing/events/day?date=${сегодня()}`,
    );
    expect(сводка.status).toBe(200);
    expect(сводка.body.показалиАдрес).toEqual({ всего: 1, наши: 0, живые: 1 });
    expect(сводка.body.оставилиАдрес).toEqual({ всего: 1, наши: 0, живые: 1 });
    expect(сводка.body.решилиЗадачу).toEqual({ всего: 1, наши: 1, живые: 0 });
    expect(сводка.body.дошлиПоПорогу).toEqual({ всего: 1, наши: 0, живые: 1 });
  });

  it("🔴 единица — СЕССИЯ: три решённые задачи одного человека это один", async () => {
    журнал([
      событие("один", "page_view"),
      событие("один", "puzzle_solved"),
      событие("один", "puzzle_solved"),
      событие("один", "puzzle_solved"),
      событие("один", "game_progress"),
      событие("один", "game_progress"),
    ]);
    const app = await приложение();
    const r = await request(app).get("/api/pricing/events/funnel?days=1");
    const с = r.body.byEntryPage["youtube|/cyberchess"];
    expect(с.решилиЗадачу, "события сложились вместо сессий").toBe(1);
    expect(с.дошлиПоПорогу).toBe(1);
    const сводка = await request(app).get(`/api/pricing/events/day?date=${сегодня()}`);
    expect(сводка.body.решилиЗадачу.всего).toBe(1);
  });

  it("🔴 ступени есть и в разрезе по КАНАЛАМ, под английскими именами", async () => {
    // Иначе вопрос «какой канал приводит тех, кто оставляет адрес» останется
    // без ответа: страница входа и канал отвечают на разные вопросы.
    журнал([событие("живой", "page_view"), событие("живой", "waitlist_submit")]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    expect(r.body.byChannel.youtube.waitlistSubmitted).toBe(1);
    expect(r.body.byChannel.youtube.waitlistSubmittedOurs).toBe(0);
    /*
     * Итогов в ответе ДВА, и новые ступени живут в сессионном: `total` собран по
     * дням (сумма суточных уникальных сессий), `totalBySession` — уникальные
     * сессии за всё окно. Я ждал поля в `total` и был неправ: там же лежит и
     * ступень «попробовали», и ответ сам это говорит в `totalBySessionUnits`.
     * Складывать два итога между собой нельзя.
     */
    expect(r.body.totalBySession.waitlistSubmitted).toBe(1);
    expect(r.body.total.waitlistSubmitted, "ступень попала не на ту ось").toBeUndefined();
  });

  it("КОНТРОЛЬ: поля есть у КАЖДОЙ строки, даже когда событий не было", async () => {
    // «Поля нет» и «ноль» читаются по-разному: первое значит «прод старше
    // правки», второе — «людей не было».
    журнал([событие("тихий", "page_view")]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    const с = r.body.byEntryPage["youtube|/cyberchess"];
    for (const поле of [
      "показалиАдрес",
      "показалиАдресНаших",
      "оставилиАдрес",
      "оставилиАдресНаших",
      "решилиЗадачу",
      "решилиЗадачуНаших",
      "дошлиПоПорогу",
      "дошлиПоПорогуНаших",
    ]) {
      expect(typeof с[поле], `нет поля ${поле}`).toBe("number");
      expect(с[поле]).toBe(0);
    }
  });
});

/*
 * 🔴 СВЁРТКИ «ПРОЧИЕ» И «ПРОЧИЕ-ЖИВЫЕ»: ДЫРУ НАШЛО ОКНО ПРИЁМКИ (user-99, 11.10.2026).
 *
 * Они прогнали мутацию, до которой я не дошёл: обнулили слагаемое в ОБОИХ
 * свёртках разом (`показалиАдрес: а.показалиАдрес + т.показалиАдрес` → `0`), и
 * мои шесть проверок остались зелёными — мутация выжила. Причина не в предмете,
 * а в сценарии: у меня было несколько строк, предел живых на канал не
 * переполнялся, складывать было нечего.
 *
 * Чем это опасно: в свёртки попадают (а) живые страницы СВЕРХ предела и
 * (б) строки вовсе без живых — то есть наши пробы. Поломка там даёт недоучёт
 * ровно в том месте, которым воронку читают «живое против нашего».
 *
 * Поэтому здесь строк БОЛЬШЕ предела, есть строка без живых, и проверяется не
 * «поле есть», а РАВЕНСТВО: сумма по всем строкам разреза равна числу сессий,
 * у которых событие было. Обнуление любого слагаемого это равенство ломает.
 */
describe("свёртки «прочие» считают новые ступени", () => {
  const ЖИВЫХ_СТРАНИЦ = 103; // больше предела в 100 живых строк на канал

  function многоСтраниц() {
    const события: Array<Record<string, unknown>> = [];
    for (let i = 1; i <= ЖИВЫХ_СТРАНИЦ; i += 1) {
      const sid = `живой-${i}`;
      const путь = `/stranica-${i}`;
      события.push({
        type: "page_view",
        ts: сейчас(),
        sid,
        path: `${путь}?c=yt`,
        meta: { channel: "youtube" },
      });
      // ВСЕ ЧЕТЫРЕ события у каждой страницы: прогон мутаций по свёрткам 11.10
      // показал, что при двух событиях пять слагаемых из восьми не охранялись
      // вовсе — обнуление ничего не меняло, потому что складывать было нечего.
      for (const имя of ИМЕНА) {
        события.push({ type: имя, ts: сейчас(), sid, path: путь, meta: { channel: "youtube" } });
      }
    }
    // Строка БЕЗ живых: только наша проба. Такая страница уходит в «прочие».
    события.push({
      type: "page_view",
      ts: сейчас(),
      sid: "наш",
      path: "/stranica-nasha?c=yt&probe=okno",
      meta: { channel: "youtube" },
    });
    for (const имя of ИМЕНА) {
      события.push({
        type: имя,
        ts: сейчас(),
        sid: "наш",
        path: "/stranica-nasha",
        meta: { channel: "youtube" },
      });
    }
    return события;
  }

  it("🔴 сумма ступени по ВСЕМ строкам равна числу сессий с событием", async () => {
    журнал(многоСтраниц());
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    expect(r.status).toBe(200);
    const строки = Object.entries(r.body.byEntryPage) as Array<[string, Record<string, number>]>;

    // Свёртки обязаны существовать, иначе сценарий не доходит до проверяемого
    // места: «прочие-живые» — живые сверх предела, «прочие» — строки без живых.
    const ключи = строки.map(([к]) => к);
    expect(
      ключи,
      "нет строки «прочие-живые» — предел живых на канал вырос, подними ЖИВЫХ_СТРАНИЦ",
    ).toContain("youtube|прочие-живые");
    expect(ключи, "нет строки «прочие» — устройство разреза изменилось").toContain(
      "youtube|прочие",
    );

    const сумма = (поле: string) => строки.reduce((а, [, т]) => а + (т[поле] ?? 0), 0);
    // Событие было у всех живых и у одной нашей сессии.
    expect(сумма("показалиАдрес"), "ступень потерялась при свёртке").toBe(ЖИВЫХ_СТРАНИЦ + 1);
    expect(сумма("показалиАдресНаших")).toBe(1);
    for (const поле of ["оставилиАдрес", "решилиЗадачу", "дошлиПоПорогу"]) {
      expect(сумма(поле), `ступень ${поле} потерялась при свёртке`).toBe(ЖИВЫХ_СТРАНИЦ + 1);
      expect(сумма(поле + "Наших"), `наши у ${поле} потерялись при свёртке`).toBe(1);
    }
    // И сессии сошлись — контроль, что сценарий вообще тот, что задуман.
    expect(сумма("сессий")).toBe(ЖИВЫХ_СТРАНИЦ + 1);
  });

  it("🔴 в свёртке живых сверх предела ступень НЕ ноль", async () => {
    журнал(многоСтраниц());
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    const свёртка = r.body.byEntryPage["youtube|прочие-живые"];
    expect(свёртка, "свёртки живых нет").toBeTruthy();
    // Сверх предела ушло ЖИВЫХ_СТРАНИЦ − 100 строк, у каждой ступень равна 1.
    expect(свёртка.сессий, "в свёртку попало не столько строк").toBe(ЖИВЫХ_СТРАНИЦ - 100);
    expect(свёртка.показалиАдрес, "ступень в свёртке живых не сложена").toBe(ЖИВЫХ_СТРАНИЦ - 100);
    for (const поле of ["оставилиАдрес", "решилиЗадачу", "дошлиПоПорогу"]) {
      expect(свёртка[поле], `ступень ${поле} в свёртке живых не сложена`).toBe(ЖИВЫХ_СТРАНИЦ - 100);
      expect(свёртка[поле + "Наших"]).toBe(0);
    }
    expect(свёртка.показалиАдресНаших).toBe(0);
  });

  it("🔴 в свёртке строк БЕЗ живых наша проба названа нашей", async () => {
    журнал(многоСтраниц());
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    const прочие = r.body.byEntryPage["youtube|прочие"];
    expect(прочие, "свёртки «прочие» нет").toBeTruthy();
    expect(прочие.сессий).toBe(1);
    expect(прочие.показалиАдрес, "ступень в свёртке «прочие» не сложена").toBe(1);
    expect(прочие.показалиАдресНаших, "наша проба в свёртке потеряна").toBe(1);
    expect(прочие.показалиАдрес - прочие.показалиАдресНаших, "живых тут быть не должно").toBe(0);
    for (const поле of ["оставилиАдрес", "решилиЗадачу", "дошлиПоПорогу"]) {
      expect(прочие[поле], `ступень ${поле} в свёртке «прочие» не сложена`).toBe(1);
      expect(прочие[поле + "Наших"], `наша проба у ${поле} потеряна`).toBe(1);
    }
  });
});
