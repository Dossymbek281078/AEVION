import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express from "express";
import request from "supertest";

/*
 * Две правки одного дня, обе по слову оркестратора 07.10.2026.
 *
 * 1. 🔴 «ПОПРОБОВАЛИ» — ступень, которой не было. У DevHub человек сперва
 *    что-то ДЕЛАЕТ (feature_use: генерация, публикация, сборка из идеи), а до
 *    цен доходит много позже. Воронка умела спрашивать только «дошёл до цен», и
 *    на вопрос «попробовал ли кто-нибудь из 21 человека с Product Hunt» не было
 *    ни «да», ни «нет» — не было самой ступени.
 *
 * 2. 🔴 СТРАНИЦА С ЖИВОЙ СЕССИЕЙ — СВОЯ СТРОКА. Прежде разрез брал восемь самых
 *    частых страниц канала, и редкая страница падала в «прочие» вместе с
 *    чужими. Повод прямой: сосед спросил живые визиты на /qspace и не нашёл их.
 *    Разрез, отвечающий только про крупное, бесполезен там, где ищут новое.
 *
 * ⚠️ Импорты модуля — только `await import` внутри тестов: путь к журналу
 * читается ПРИ ИМПОРТЕ, и статическая строка заставила бы ручку читать
 * настоящий журнал (один сторож так уже был зелёным на 122 чужих событиях).
 */
const каталог = mkdtempSync(join(tmpdir(), "aevion-tried-"));
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

async function воронка() {
  const { eventsRouter } = await import("../src/routes/events");
  const app = express();
  app.use("/api/pricing/events", eventsRouter);
  return request(app).get("/api/pricing/events/funnel?days=1");
}

describe("ступень «попробовали»", () => {
  it("🔴 сессия с feature_use видна каналу и посту, в теле ответа", async () => {
    журнал([
      { type: "page_view", ts: сейчас(), sid: "ph-1", path: "/en/devhub?c=ph-launch", meta: { channel: "product-hunt", post: "launch" } },
      { type: "feature_use", ts: сейчас(), sid: "ph-1", path: "/en/devhub", meta: { channel: "product-hunt", post: "launch" } },
      // Второй человек только посмотрел — он НЕ попробовал.
      { type: "page_view", ts: сейчас(), sid: "ph-2", path: "/en/devhub?c=ph-launch", meta: { channel: "product-hunt", post: "launch" } },
    ]);
    const r = await воронка();
    expect(r.status).toBe(200);
    expect(r.body.byChannel["product-hunt"].visits).toBe(2);
    expect(r.body.byChannel["product-hunt"].tried, "ступень посчитана, но не отдана").toBe(1);
    expect(r.body.byChannel["product-hunt"].triedOurs).toBe(0);
    expect(r.body.byPost["product-hunt/launch"].tried).toBe(1);
  });

  it("единица — СЕССИЯ: три действия одного человека это один «попробовал»", async () => {
    // Иначе число нельзя сравнить с «дошли до цен» в той же строке, а
    // сравнивают их именно между собой.
    журнал([
      { type: "page_view", ts: сейчас(), sid: "один", path: "/devhub?c=yt", meta: { channel: "youtube" } },
      { type: "feature_use", ts: сейчас(), sid: "один", path: "/devhub", meta: { channel: "youtube" } },
      { type: "feature_use", ts: сейчас(), sid: "один", path: "/devhub", meta: { channel: "youtube" } },
      { type: "feature_use", ts: сейчас(), sid: "один", path: "/devhub", meta: { channel: "youtube" } },
    ]);
    const r = await воронка();
    expect(r.body.byChannel.youtube.tried).toBe(1);
  });

  it("наши пробы отделены: иначе свои прогоны станут «попробовали»", async () => {
    журнал([
      { type: "page_view", ts: сейчас(), sid: "наш", path: "/devhub?c=probe-okno", meta: { channel: "probe-okno" } },
      { type: "feature_use", ts: сейчас(), sid: "наш", path: "/devhub", meta: { channel: "probe-okno" } },
    ]);
    const r = await воронка();
    const к = r.body.byChannel["probe-okno"];
    expect(к.tried).toBe(1);
    expect(к.triedOurs, "наша проба не помечена нашей").toBe(1);
    expect(к.tried - к.triedOurs, "наша проба ушла в живое число").toBe(0);
  });

  it("КОНТРОЛЬ: без feature_use ступень ноль, а не единица", async () => {
    журнал([
      { type: "page_view", ts: сейчас(), sid: "смотрел", path: "/devhub?c=yt", meta: { channel: "youtube" } },
      { type: "page_view", ts: сейчас(), sid: "смотрел", path: "/pricing", meta: { channel: "youtube" } },
      { type: "checkout_start", ts: сейчас(), sid: "смотрел", path: "/pricing", meta: { channel: "youtube", app: "devhub" } },
    ]);
    const r = await воронка();
    expect(r.body.byChannel.youtube.tried).toBe(0);
    // И контроль, что прибор вообще считает: соседние ступени на месте.
    expect(r.body.byChannel.youtube.pricing).toBe(1);
    expect(r.body.byChannel.youtube.checkoutStart).toBe(1);
  });
});

describe("ступень «попробовали» в сводке дня", () => {
  it("🔴 сводка дня несёт ступень отдельной строкой, с нашими и живыми", async () => {
    /*
     * Сводка дня — то самое число, которое идёт основателю в 21:00. Если
     * ступени там нет, вопрос «попробовал ли кто-нибудь» снова некому задать:
     * разрезы по каналам читает тот, кто спрашивает ручку, а отчёт собирается
     * из сводки.
     */
    журнал([
      { type: "page_view", ts: сейчас(), sid: "живой", path: "/devhub?c=ph", meta: { channel: "product-hunt" } },
      { type: "feature_use", ts: сейчас(), sid: "живой", path: "/devhub", meta: { channel: "product-hunt" } },
      { type: "page_view", ts: сейчас(), sid: "наш", path: "/devhub?c=probe-okno", meta: { channel: "probe-okno" } },
      { type: "feature_use", ts: сейчас(), sid: "наш", path: "/devhub", meta: { channel: "probe-okno" } },
      { type: "page_view", ts: сейчас(), sid: "смотрел", path: "/devhub?c=yt", meta: { channel: "youtube" } },
    ]);
    const { eventsRouter } = await import("../src/routes/events");
    const app = express();
    app.use("/api/pricing/events", eventsRouter);
    const день = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const r = await request(app).get(`/api/pricing/events/day?date=${день}`);
    expect(r.status).toBe(200);
    expect(Object.keys(r.body), "ступень посчитана, но не отдана").toContain("попробовали");
    expect(r.body.попробовали).toEqual({ всего: 2, наши: 1, живые: 1 });
    // Контроль соседних строк: тот, кто только смотрел, в ступень не попал.
    expect(r.body.визиты.всего).toBe(3);
  });

  it("итог воронки тоже знает ступень — два читателя одного числа", async () => {
    журнал([
      { type: "page_view", ts: сейчас(), sid: "ж", path: "/devhub?c=ph", meta: { channel: "product-hunt" } },
      { type: "feature_use", ts: сейчас(), sid: "ж", path: "/devhub", meta: { channel: "product-hunt" } },
    ]);
    const r = await воронка();
    /*
     * 🔴 Ступень живёт в `totalBySession`, а НЕ в `total`, и я на этом
     * оступился, когда писал тест: у воронки `total` — свой объект, собранный
     * из суточных уникальных сессий, другой оси. Два разных итога под одним
     * именем — тот же класс, из-за которого вчера разъехались 438 и 431.
     * Теперь у каждого своё имя и своя подпись единицы.
     */
    expect(r.body.totalBySession.tried).toBe(1);
    expect(r.body.totalBySession.triedOurs).toBe(0);
    expect(r.body.totalBySessionUnits).toMatch(/уникальные сессии за всё окно/);
    // И совпадение с разрезом: сумма по каналам тут равна итогу, потому что
    // канал один — на большем числе каналов они законно расходятся.
    expect(r.body.byChannel["product-hunt"].tried).toBe(1);
  });
});

describe("страница входа с живой сессией — своя строка", () => {
  it("🔴 страница с ОДНОЙ живой сессией не сворачивается в «прочие»", async () => {
    /*
     * Девять страниц одного канала: прежнее правило («восемь самых частых»)
     * увело бы девятую в «прочие», и именно так пропал /qspace. Проверяем
     * редкую страницу с одной живой сессией — её и ищут, когда смотрят новое.
     */
    const события: Array<Record<string, unknown>> = [];
    for (let i = 0; i < 8; i += 1) {
      for (let j = 0; j < 3; j += 1) {
        события.push({
          type: "page_view",
          ts: сейчас(),
          sid: `частая-${i}-${j}`,
          path: `/chastaya${i}?c=yt`,
          meta: { channel: "youtube" },
        });
      }
    }
    события.push({
      type: "page_view",
      ts: сейчас(),
      sid: "редкий",
      path: "/qspace?c=yt",
      meta: { channel: "youtube" },
    });
    журнал(события);

    const r = await воронка();
    const ключи = Object.keys(r.body.byEntryPage);
    expect(ключи, "редкая страница свёрнута в «прочие»").toContain("youtube|/qspace");
    expect(r.body.byEntryPage["youtube|/qspace"].сессий).toBe(1);
    expect(r.body.byEntryPage["youtube|/qspace"].сессийНаших).toBe(0);
  });

  it("🔴 страница, где были ТОЛЬКО наши, уходит в «прочие»", async () => {
    // Обратная сторона правила: «прочие» остаются для наших и пустых, иначе
    // разрез раздувается нашими же пробами, которых в живых числах нет.
    журнал([
      { type: "page_view", ts: сейчас(), sid: "ж", path: "/zhivaya?c=yt", meta: { channel: "youtube" } },
      { type: "page_view", ts: сейчас(), sid: "п1", path: "/nasha?c=yt&probe=okno", meta: { channel: "youtube" } },
      { type: "page_view", ts: сейчас(), sid: "п2", path: "/nasha2?c=yt&probe=okno", meta: { channel: "youtube" } },
    ]);
    const r = await воронка();
    const ключи = Object.keys(r.body.byEntryPage);
    expect(ключи).toContain("youtube|/zhivaya");
    expect(ключи, "страница без живых осталась отдельной строкой").not.toContain("youtube|/nasha");
    const прочие = r.body.byEntryPage["youtube|прочие"];
    expect(прочие, "«прочие» не собрались вовсе").toBeTruthy();
    expect(прочие.сессий).toBe(2);
    expect(прочие.сессийНаших).toBe(2);
    expect(прочие.сессий - прочие.сессийНаших, "в «прочих» оказались живые").toBe(0);
  });

  it("«попробовали» есть и у страницы входа", async () => {
    журнал([
      { type: "page_view", ts: сейчас(), sid: "д", path: "/devhub?c=ph", meta: { channel: "product-hunt" } },
      { type: "feature_use", ts: сейчас(), sid: "д", path: "/devhub", meta: { channel: "product-hunt" } },
    ]);
    const r = await воронка();
    const строка = r.body.byEntryPage["product-hunt|/devhub"];
    expect(строка, "страница входа пропала").toBeTruthy();
    expect(строка.попробовали).toBe(1);
    expect(строка.попробовалиНаших).toBe(0);
  });
});
