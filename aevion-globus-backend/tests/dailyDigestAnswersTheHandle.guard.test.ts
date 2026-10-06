import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express from "express";
import request from "supertest";

/**
 * Сводка дня проверяется ЗАПРОСОМ К РУЧКЕ и чтением ТЕЛА ответа.
 *
 * 🔴 Ровно здесь у нас уже дважды терялись готовые разрезы: функция считала,
 * а `res.json` их не отдавал, и все сторожа на функцию были зелёные
 * (30.09 — byPost и byEntryPage, 06.10 — byUnknownTag). Поэтому сторож на
 * место склейки «посчитал → отдал», а не на вычисление.
 */
const ДЕНЬ = "2026-10-05";
// 10:00 Алматы = 05:00 UTC того же дня.
const вДень = (чч: number) => `2026-10-05T${String(чч - 5).padStart(2, "0")}:00:00.000Z`;

/*
 * 🔴 Каталог и переменная — ОДИН раз на файл, а не на каждый тест.
 *
 * Путь к журналу читается модулем при импорте, а модуль кешируется между
 * тестами. Если менять переменную в `beforeEach`, второй тест смотрит в
 * каталог, который `afterEach` уже снёс, — ручка честно отвечает
 * «store_missing», а выглядит это как «поле пропало из ответа». Первый тест при
 * этом зелёный, и причина ищется не там.
 */
const каталог = mkdtempSync(join(tmpdir(), "aevion-day-"));
const файл = join(каталог, "events.jsonl");
process.env.EVENTS_FILE = файл;

function событие(о: Record<string, unknown>): string {
  return JSON.stringify({ ua: "Mozilla/5.0 (Windows NT 10.0) Chrome/120 Safari/537.36", ...о });
}

beforeEach(() => {
  writeFileSync(файл, "");
});

// Каталог сносим ОДИН раз в конце: `afterEach` убивал его после первого теста,
// и следующий падал на записи файла — выглядело как «ручка перестала отвечать».
afterAll(() => {
  rmSync(каталог, { recursive: true, force: true });
});

async function ответ() {
  // Поднимаем РОУТЕР, как это делают соседние сторожа: так проверяется
  // настоящий путь «запрос → обработчик → тело ответа», а не копия логики.
  const { eventsRouter } = await import("../src/routes/events");
  const приложение = express();
  приложение.use("/api/pricing/events", eventsRouter);
  return request(приложение).get(`/api/pricing/events/day?date=${ДЕНЬ}`);
}

describe("ручка сводки дня отдаёт то, что посчитала", () => {
  it("🔴 тело ответа несёт все обещанные поля", async () => {
    writeFileSync(
      файл,
      [
        событие({ type: "page_view", ts: вДень(10), sid: "живой", path: "/go?c=ig", meta: { channel: "instagram" } }),
        событие({ type: "page_view", ts: вДень(11), sid: "живой", path: "/pricing", meta: { channel: "instagram" } }),
        событие({ type: "page_view", ts: вДень(12), sid: "наш", path: "/go?c=probe-okno", meta: { channel: "instagram" } }),
        событие({ type: "page_view", ts: вДень(12), sid: "наш", path: "/pricing", meta: { channel: "instagram" } }),
      ].join("\n") + "\n",
    );
    const r = await ответ();
    expect(r.status).toBe(200);
    for (const поле of ["дата", "визиты", "доЦен", "началиОплату", "оплаты", "топПостов", "единицы", "зона"]) {
      expect(Object.keys(r.body), `поле ${поле} посчитано, но не отдано`).toContain(поле);
    }
    expect(r.body.дата).toBe(ДЕНЬ);
    expect(r.body.визиты, "наш заход не отделён от живого").toEqual({ всего: 2, наши: 1, живые: 1 });
    expect(r.body.доЦен).toEqual({ всего: 2, наши: 1, живые: 1 });
  });

  it("🔴 события СОСЕДНИХ дней в сводку не попадают", async () => {
    writeFileSync(
      файл,
      [
        событие({ type: "page_view", ts: "2026-10-04T18:59:00.000Z", sid: "вчера", path: "/go", meta: { channel: "direct" } }),
        событие({ type: "page_view", ts: вДень(10), sid: "сегодня", path: "/go", meta: { channel: "direct" } }),
        событие({ type: "page_view", ts: "2026-10-05T19:00:00.000Z", sid: "завтра", path: "/go", meta: { channel: "direct" } }),
      ].join("\n") + "\n",
    );
    const r = await ответ();
    expect(r.body.визиты.всего, "в день затесался сосед").toBe(1);
  });

  it("КОНТРОЛЬ: автоматика отсеяна и названа отдельным числом", async () => {
    writeFileSync(
      файл,
      [
        событие({ type: "page_view", ts: вДень(10), sid: "человек", path: "/go", meta: { channel: "direct" } }),
        событие({ type: "page_view", ts: вДень(10), sid: "робот", path: "/go", meta: { channel: "direct" }, webdriver: true }),
        JSON.stringify({ type: "page_view", ts: вДень(10), sid: "зонд", path: "/go", ua: "AEVION-probe/1.0", meta: { channel: "direct" } }),
      ].join("\n") + "\n",
    );
    const r = await ответ();
    expect(r.body.визиты.всего, "автоматика посчитана живым визитом").toBe(1);
    expect(r.body.отсеяноАвтоматики, "отсев не назван числом").toBe(2);
  });

  it("топ постов отдаётся и отделяет наши от живых", async () => {
    writeFileSync(
      файл,
      [
        событие({ type: "page_view", ts: вДень(10), sid: "ж1", path: "/go?c=ig-post1", meta: { channel: "instagram", post: "post1" } }),
        событие({ type: "page_view", ts: вДень(10), sid: "ж2", path: "/go?c=ig-post1", meta: { channel: "instagram", post: "post1" } }),
        событие({ type: "page_view", ts: вДень(11), sid: "н1", path: "/go?c=probe-okno", meta: { channel: "instagram", post: "post2" } }),
      ].join("\n") + "\n",
    );
    const r = await ответ();
    const первый = r.body.топПостов[0];
    expect(первый.ключ).toBe("instagram/post1");
    expect(первый.визитыЖивые).toBe(2);
    const наш = r.body.топПостов.find((п: { ключ: string }) => п.ключ === "instagram/post2");
    expect(наш.визитыЖивые, "наш заход посчитан живым").toBe(0);
  });
});
