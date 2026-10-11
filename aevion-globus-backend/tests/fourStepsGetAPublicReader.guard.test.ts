import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express from "express";
import request from "supertest";

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
const сегодня = () => new Date().toISOString().slice(0, 10);

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
