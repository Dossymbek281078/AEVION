import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express from "express";
import request from "supertest";

/*
 * 🔴 «НАЧАЛИ ОПЛАТУ» ПО СТРАНИЦЕ ВХОДА ОТДЕЛЯЕТ НАШИ ПРОБЫ.
 *
 * Повод 11.10.2026, недельный замер мерила цели 31.12: у QMELANIN в отчёте
 * стояло «живых 5, читали 0, касса 2». Два начала оплаты на странице, где никто
 * не задержался даже на чтение, — это почти наверняка наши прогоны кассы. Но
 * вычесть их было НЕЧЕМ: у этой ступени в разрезе страниц входа поля «наших» не
 * существовало вовсе, в отличие от всех соседних ступеней.
 *
 * Чем это опасно: «начали оплату» — предпоследняя ступень перед деньгами, и
 * именно её читают в недельном отчёте по цели. Наша проба, прочитанная как
 * покупатель, делает картину лучше, чем она есть, — ровно то, из-за чего 29.09
 * первые две «оплаты» оказались проверками кассы самим основателем.
 *
 * ⚠️ Два устройства разреза, на которых моя первая версия сторожа села в лужу, и
 * оба — поведение, а не дефект:
 *   1. Ключ строки — `канал|страница`, и КАНАЛ берётся из `meta.channel`, а не
 *      из метки в адресе. Метка решает только вопрос «наше ли это».
 *   2. Страница, у которой НЕТ живых сессий, собирается в `<канал>|прочие`
 *      (решение 07.10: свою строку получает страница хотя бы с одной живой
 *      сессией). Поэтому проба, пришедшая под своим каналом `probe-*`, строки
 *      по имени страницы не получает.
 * Отсюда главный случай здесь: наша проба ВНУТРИ живого канала — то есть там,
 * где её и надо вычитать.
 */
const каталог = mkdtempSync(join(tmpdir(), "aevion-entry-checkout-"));
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
  app.use("/api/pricing/events", eventsRouter);
  return app;
}

/** Просмотр страницы в канале youtube; `наш` помечает заход меткой пробы. */
function просмотр(sid: string, наш = false) {
  return {
    type: "page_view",
    ts: сейчас(),
    sid,
    path: наш ? "/qmelanin?c=yt&probe=okno" : "/qmelanin?c=yt",
    meta: { channel: "youtube" },
  };
}

function нажалКупить(sid: string) {
  return { type: "checkout_start", ts: сейчас(), sid, path: "/qmelanin", meta: { channel: "youtube" } };
}

describe("начала оплаты по странице входа: наши отдельно", () => {
  it("🔴 наша проба ВНУТРИ живого канала не читается покупателем", async () => {
    журнал([
      просмотр("наш", true),
      нажалКупить("наш"),
      просмотр("живой"),
      нажалКупить("живой"),
    ]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    expect(r.status).toBe(200);

    const строка = r.body.byEntryPage["youtube|/qmelanin"];
    expect(строка, "строки живой страницы нет").toBeTruthy();
    expect(строка.сессий).toBe(2);
    expect(строка.сессийНаших).toBe(1);
    expect(строка.началиОплату).toBe(2);
    expect(строка.началиОплатуНаших, "наша проба кассы не отделена").toBe(1);
    expect(
      строка.началиОплату - строка.началиОплатуНаших,
      "живых начал оплаты вышло не столько",
    ).toBe(1);
  });

  it("🔴 поле есть у КАЖДОЙ строки разреза, включая «прочие»", async () => {
    // Иначе читатель не отличит «наших не было» от «поля нет» и вычтет
    // undefined: получится NaN или тихий ноль там, где ответа нет.
    журнал([
      просмотр("живой"),
      { type: "page_view", ts: сейчас(), sid: "b", path: "/qrenew?c=ig", meta: { channel: "instagram" } },
      // Проба под СВОИМ каналом: её страница собирается в «прочие».
      {
        type: "page_view",
        ts: сейчас(),
        sid: "наш",
        path: "/qsign?c=probe-okno",
        meta: { channel: "probe-okno" },
      },
      { type: "checkout_start", ts: сейчас(), sid: "наш", path: "/qsign", meta: { channel: "probe-okno" } },
    ]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    const записи = Object.entries(r.body.byEntryPage) as Array<[string, Record<string, unknown>]>;
    expect(записи.length).toBeGreaterThanOrEqual(3);
    for (const [ключ, с] of записи) {
      expect(typeof с.началиОплату, `нет поля началиОплату у ${ключ}`).toBe("number");
      expect(typeof с.началиОплатуНаших, `нет поля началиОплатуНаших у ${ключ}`).toBe("number");
    }
    const прочие = r.body.byEntryPage["probe-okno|прочие"] as Record<string, number>;
    expect(прочие, "строки «прочие» нет — устройство разреза изменилось").toBeTruthy();
    expect(прочие.началиОплату).toBe(1);
    expect(прочие.началиОплатуНаших, "в «прочих» наша проба потеряна").toBe(1);
  });

  it("🔴 наша сессия БЕЗ нажатия в «наши начала оплаты» не попадает", async () => {
    /*
     * Нашла мутация, которую первая версия сторожа пропустила: условие
     * `если наш` вместо `если наш И начал` выжило, потому что у меня проба
     * всегда ещё и нажимала. А в жизни наши пробы чаще просто ЗАХОДЯТ — и тогда
     * «наших начал оплаты» стало бы больше, чем начал оплаты вообще, то есть
     * живое число ушло бы в минус и выглядело бы скромностью, а не дефектом.
     */
    журнал([просмотр("наш-только-зашёл", true), просмотр("живой"), нажалКупить("живой")]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    const строка = r.body.byEntryPage["youtube|/qmelanin"];
    expect(строка.сессийНаших, "проба не распознана как наша").toBe(1);
    expect(строка.началиОплату).toBe(1);
    expect(строка.началиОплатуНаших, "наша сессия без нажатия зачтена началом оплаты").toBe(0);
    expect(строка.началиОплату - строка.началиОплатуНаших).toBe(1);
  });

  it("единица та же, что у соседей: три нажатия одной сессии — один", async () => {
    журнал([
      просмотр("наш", true),
      нажалКупить("наш"),
      нажалКупить("наш"),
      нажалКупить("наш"),
      просмотр("живой"),
    ]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    const строка = r.body.byEntryPage["youtube|/qmelanin"];
    expect(строка.началиОплату, "события сложились вместо сессии").toBe(1);
    expect(строка.началиОплатуНаших).toBe(1);
  });

  it("КОНТРОЛЬ: проба, помеченная флагом, а не меткой в адресе, тоже наша", async () => {
    журнал([
      { ...просмотр("флаг"), probe: true },
      нажалКупить("флаг"),
      просмотр("живой"),
    ]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    const строка = r.body.byEntryPage["youtube|/qmelanin"];
    expect(строка.началиОплату).toBe(1);
    expect(строка.началиОплатуНаших, "проба с флагом не зачтена нашей").toBe(1);
  });
});
