import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express from "express";
import request from "supertest";

/*
 * 🔴 САМОЕ ДОРОГОЕ ПОЛЕ: «оплаты» равны подтверждениям кассы, и ничему больше.
 *
 * Дефект, ради которого сторож (нашла приёмка 06.10.2026, уже на проде):
 * в разрезе стояла ветка `else`, считавшая оплатой ВСЁ, что не просмотр, не
 * начало оплаты и не страница «спасибо» — нажатия кнопок, открытия
 * калькулятора, ежедневные задачи. Сводка дня отдала «оплаты: живые 27» за
 * 05.10 при ДВУХ продажах за всю историю.
 *
 * Ручка воронки дефект не показывала: она ПОДМЕНЯЕТ поле перед отдачей (берёт
 * оплаты по кассе). Маска прятала ошибку ровно до появления второго читателя —
 * поэтому сторож проверяет ОБЕ ручки, и проверяет равенство их чисел.
 *
 * И хуже самого числа было то, что подпись рядом утверждала обратное:
 * «оплаты подтверждает касса, а не загрузка страницы „спасибо“». Неверное
 * число с ложным обоснованием нельзя заподозрить: подпись читают первой.
 *
 * ⚠️ Импорты модуля только `await import` внутри теста: путь к журналу
 * читается при импорте (один сторож уже был зелёным на чужом журнале).
 */
const каталог = mkdtempSync(join(tmpdir(), "aevion-paid-"));
const файл = join(каталог, "events.jsonl");
process.env.EVENTS_FILE = файл;

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";
const сейчас = () => new Date().toISOString();
const деньАлматы = () => new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);

function журнал(события: Array<Record<string, unknown>>) {
  writeFileSync(файл, события.map((о) => JSON.stringify({ ua: UA, ...о })).join("\n") + "\n");
}

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

describe("оплаты — только подтверждения кассы", () => {
  it("🔴 страница «спасибо» и нажатия кнопок НЕ оплаты", async () => {
    журнал([
      { type: "page_view", ts: сейчас(), sid: "ч", path: "/pricing" },
      { type: "checkout_start", ts: сейчас(), sid: "ч", path: "/pricing", meta: { app: "devhub" } },
      { type: "checkout_success", ts: сейчас(), sid: "ч", path: "/thank-you" },
      { type: "cta_click", ts: сейчас(), sid: "ч", path: "/pricing" },
      { type: "feature_use", ts: сейчас(), sid: "ч", path: "/devhub" },
      { type: "daily_open", ts: сейчас(), sid: "ч", path: "/cyberchess" },
    ]);

    const r = await request(await приложение()).get(
      `/api/pricing/events/day?date=${деньАлматы()}`,
    );
    expect(r.status).toBe(200);
    expect(r.body.оплаты, "загрузки страниц и нажатия посчитаны как деньги").toEqual({
      всего: 0,
      наши: 0,
      живые: 0,
    });
    // Контроль обратной стороны: события не потеряны, шаги видны.
    expect(r.body.началиОплату.всего).toBe(1);
    expect(r.body.визиты.всего).toBe(1);
  });

  it("🔴 подтверждение кассы считается оплатой", async () => {
    const { СОБЫТИЕ_ОПЛАТА_ПОДТВЕРЖДЕНА } = await import("../src/routes/events");
    журнал([
      { type: СОБЫТИЕ_ОПЛАТА_ПОДТВЕРЖДЕНА, ts: сейчас(), sid: "п", path: "/", meta: { app: "devhub" } },
      { type: СОБЫТИЕ_ОПЛАТА_ПОДТВЕРЖДЕНА, ts: сейчас(), sid: "о", path: "/", meta: { app: "devhub", свой: true } },
    ]);
    const r = await request(await приложение()).get(
      `/api/pricing/events/day?date=${деньАлматы()}`,
    );
    expect(r.body.оплаты).toEqual({ всего: 2, наши: 1, живые: 1 });
  });

  it("🔴 сводка и воронка называют ОДНО число оплат на одном наборе", async () => {
    журнал([
      { type: "checkout_success", ts: сейчас(), sid: "ч", path: "/thank-you" },
      { type: "cta_click", ts: сейчас(), sid: "ч", path: "/pricing" },
    ]);
    const app = await приложение();
    const сводка = await request(app).get(`/api/pricing/events/day?date=${деньАлматы()}`);
    const воронка = await request(app).get("/api/pricing/events/funnel?days=1");
    expect(сводка.body.оплаты.всего, "сводка и воронка расходятся в деньгах").toBe(
      воронка.body.total.paid,
    );
  });

  it("неверная дата — отказ, а не вчерашние числа молча", async () => {
    const r = await request(await приложение()).get("/api/pricing/events/day?date=2026-13-99");
    expect(r.status).toBe(400);
    expect(r.body.error).toBe("bad_date");
  });

  it("КОНТРОЛЬ: дата не передана вовсе — это законно, берётся вчерашний день", async () => {
    const r = await request(await приложение()).get("/api/pricing/events/day");
    expect(r.status).toBe(200);
    expect(r.body.дата).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("разрез по каналам считает деньги только по кассе (страхует фильтр типов)", async () => {
    /*
     * 🔴 Здесь мутация НЕ краснеет, и это честный ответ, а не слабый тест.
     *
     * Я решил, что «тот же else» испортил и byChannel, и мутировал его —
     * прогон остался зелёным. Причина: byChannel считает оплаты НИЖЕ фильтра,
     * пропускающего дальше только checkout_start, checkout_success и
     * подтверждение кассы. Чужие события туда не доходят, поэтому `else` там
     * был безопасен. Дефект был ровно в одном месте — в итоге, который я
     * посчитал ВЫШЕ фильтра.
     *
     * Тест оставлен: byChannel.paid читают сводки по каналам и топ постов, то
     * есть место, где решают, «какой канал приносит деньги». Утверждение
     * верное и нужное, просто его страхует не только эта строка.
     */
    журнал([
      { type: "page_view", ts: сейчас(), sid: "ю", path: "/go?c=yt", meta: { channel: "youtube" } },
      { type: "cta_click", ts: сейчас(), sid: "ю", path: "/pricing", meta: { channel: "youtube" } },
      { type: "checkout_success", ts: сейчас(), sid: "ю", path: "/thank-you", meta: { channel: "youtube" } },
      { type: "feature_use", ts: сейчас(), sid: "ю", path: "/devhub", meta: { channel: "youtube" } },
    ]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    expect(r.status).toBe(200);
    expect(r.body.byChannel.youtube.paid, "канал «заработал» на нажатиях кнопок").toBe(0);
    expect(r.body.byChannel.youtube.thankYouOpened).toBe(1);

    const { СОБЫТИЕ_ОПЛАТА_ПОДТВЕРЖДЕНА } = await import("../src/routes/events");
    журнал([
      { type: СОБЫТИЕ_ОПЛАТА_ПОДТВЕРЖДЕНА, ts: сейчас(), sid: "ю2", path: "/", meta: { channel: "youtube", app: "devhub" } },
    ]);
    const r2 = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    expect(r2.body.byChannel.youtube.paid, "настоящая оплата не посчитана каналу").toBe(1);
  });

});
