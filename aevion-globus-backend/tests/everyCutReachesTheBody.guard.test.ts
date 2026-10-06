import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express from "express";
import request from "supertest";

/*
 * 🔴 КЛАСС, КОТОРЫЙ УКУСИЛ ТРИЖДЫ: разрез посчитан и не отдан.
 *
 *   30.09 — byPost и byEntryPage считались, а `res.json` их не содержал;
 *   06.10 — byUnknownTag то же самое (нашла приёмка, чиня мой же код);
 *   06.10 — byReferrerHost, в тот же день, у меня, при живом уроке на руках.
 *
 * ⚠️ И ловушка, на которой этот сторож сам оступился при рождении: ИМПОРТ
 * МОДУЛЯ СТАТИЧЕСКОЙ СТРОКОЙ грузит его ДО того, как файл задаст
 * `process.env.EVENTS_FILE`, — путь к журналу читается при импорте. Первая
 * версия сторожа читала НАСТОЯЩИЙ журнал (122 события, каналы direct и
 * probe-61 вместо четырёх моих) и была ЗЕЛЁНОЙ на чужих данных. Поэтому все
 * импорты этого модуля здесь — только `await import` внутри теста.
 *
 * Поэтому проверка не «есть ли в теле поле X» (такую пишут про уже известные
 * поля и забывают дописать при добавлении нового), а УТВЕРЖДЕНИЕ ОБО ВСЁМ
 * КЛАССЕ: каждый разрез, который считает `разрезВоронки`, обязан доехать до
 * тела ответа воронки. Новый разрез попадает под надзор сам, без правки
 * сторожа — именно этого не хватало все три раза.
 */
const каталог = mkdtempSync(join(tmpdir(), "aevion-cuts-"));
const файл = join(каталог, "events.jsonl");
process.env.EVENTS_FILE = файл;

const событие = (о: Record<string, unknown>) =>
  JSON.stringify({ ua: "Mozilla/5.0 (Windows NT 10.0) Chrome/120 Safari/537.36", ...о });

beforeEach(() => {
  writeFileSync(
    файл,
    [
      событие({
        type: "page_view",
        ts: new Date().toISOString(),
        sid: "живой",
        path: "/go?c=yt-post",
        meta: { channel: "youtube", post: "post" },
        refHost: "t.co",
      }),
      событие({
        type: "page_view",
        ts: new Date().toISOString(),
        sid: "живой",
        path: "/pricing",
        meta: { channel: "youtube" },
      }),
      событие({
        type: "checkout_start",
        ts: new Date().toISOString(),
        sid: "живой",
        path: "/pricing",
        meta: { channel: "youtube", app: "devhub" },
      }),
      событие({
        type: "page_view",
        ts: new Date().toISOString(),
        sid: "чужая-метка",
        path: "/go?c=neizvestnaya",
        meta: { channel: "unknown" },
      }),
    ].join("\n") + "\n",
  );
});

afterAll(() => {
  rmSync(каталог, { recursive: true, force: true });
});

describe("каждый посчитанный разрез доезжает до тела ответа", () => {
  it("🔴 все ключи разрезВоронки присутствуют в ответе /funnel", async () => {
    const { eventsRouter } = await import("../src/routes/events");
    const app = express();
    app.use("/api/pricing/events", eventsRouter);

    const r = await request(app).get("/api/pricing/events/funnel?days=1");
    expect(r.status).toBe(200);

    /*
     * Имена разрезов берём у самой функции на ТЕХ ЖЕ событиях, а не из списка
     * в тесте: список пришлось бы дописывать руками, и тогда новый разрез снова
     * остался бы без надзора. `total`/`totalUnits` — не разрезы, итог живёт в
     * ответе под именем `total` у обеих ручек и проверяется своими сторожами.
     */
    const { разрезВоронки } = await import("../src/routes/events");
    const посчитаны = Object.keys(
      разрезВоронки(
        [
          { type: "page_view", path: "/go?c=yt", sid: "s", meta: { channel: "youtube" } },
          { type: "page_view", path: "/pricing", sid: "s", meta: { channel: "youtube" } },
        ],
        new Set(),
        new Set(),
      ),
    );
    // Контроль прибора: функция действительно отдаёт разрезы, а не пустоту —
    // иначе «все ключи на месте» было бы истиной ни о чём.
    expect(посчитаны.length).toBeGreaterThanOrEqual(6);

    const вТеле = Object.keys(r.body);
    const потерянные = посчитаны.filter((к) => !вТеле.includes(к));
    expect(потерянные, `разрезы посчитаны, но не отданы: ${потерянные.join(", ")}`).toEqual([]);
  });

  it("у каждого отданного разреза есть содержимое, а не пустой объект", async () => {
    // «Поле есть» и «поле отвечает» — разные утверждения: пустой объект
    // прошёл бы предыдущую проверку и читался бы как «никто не приходил».
    const { eventsRouter } = await import("../src/routes/events");
    const app = express();
    app.use("/api/pricing/events", eventsRouter);
    const r = await request(app).get("/api/pricing/events/funnel?days=1");

    expect(Object.keys(r.body.byChannel).length).toBeGreaterThan(0);
    expect(Object.keys(r.body.byPost).length).toBeGreaterThan(0);
    expect(Object.keys(r.body.byEntryPage).length).toBeGreaterThan(0);
    expect(Object.keys(r.body.byUnknownTag).length).toBeGreaterThan(0);
    expect(Object.keys(r.body.byReferrerHost).length).toBeGreaterThan(0);
  });
});
