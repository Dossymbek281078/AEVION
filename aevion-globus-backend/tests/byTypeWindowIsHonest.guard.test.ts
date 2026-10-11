import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express from "express";
import request from "supertest";

/*
 * 🔴 ОКНО РУЧКИ «ПО ТИПАМ» ОТВЕЧАЕТ НА ТОТ ВОПРОС, КОТОРЫЙ ЗАДАЛИ.
 *
 * Два дефекта, нашло окно 99 (07.10.2026):
 *
 * 1. `?days=1`, `?days=3`, `?days=7` давали ОДНО И ТО ЖЕ: ручка знала только
 *    `day` и параметр молча игнорировала. Это хуже отказа — отказ видно, а
 *    подмену окна нет: сосед читал три разных окна и получал одни числа.
 *
 * 2. Резала по UTC-дате строкой (`ev.ts.slice(0,10)`), тогда как сводка `/day`
 *    считает календарные сутки Алматы. Два смысла слова «день» в одном файле:
 *    события с 00:00 до 05:00 по Алматы попадали у двух ручек в РАЗНЫЕ дни, и
 *    числа законно расходились, не будучи неверными ни там, ни тут.
 *
 * ⚠️ Импорты модуля — только `await import` внутри теста: путь к журналу
 * читается ПРИ ИМПОРТЕ.
 */
const каталог = mkdtempSync(join(tmpdir(), "aevion-bytype-"));
const файл = join(каталог, "events.jsonl");
process.env.EVENTS_FILE = файл;

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";
const СМЕЩЕНИЕ = 5 * 60 * 60 * 1000;

/** Сегодняшняя дата по Алматы — тот день, который ручка берёт по умолчанию. */
const сегодняАлматы = () => new Date(Date.now() + СМЕЩЕНИЕ).toISOString().slice(0, 10);

/** Метка времени «N суток назад, в середине дня по Алматы». */
function сутокНазад(n: number): string {
  const местное = new Date(Date.now() + СМЕЩЕНИЕ - n * 24 * 60 * 60 * 1000);
  const дата = местное.toISOString().slice(0, 10);
  // 12:00 по Алматы = 07:00 UTC — заведомо внутри нужных суток при любой зоне.
  return `${дата}T07:00:00.000Z`;
}

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

describe("окно «по типам» честное", () => {
  it("🔴 days=1 и days=7 дают РАЗНЫЕ числа, когда события в разных сутках", async () => {
    журнал([
      { type: "cta_click", ts: сутокНазад(0), sid: "с0", path: "/" },
      { type: "cta_click", ts: сутокНазад(2), sid: "с2", path: "/" },
      { type: "cta_click", ts: сутокНазад(5), sid: "с5", path: "/" },
      // Девять суток назад — за пределами даже недельного окна.
      { type: "cta_click", ts: сутокНазад(9), sid: "с9", path: "/" },
    ]);
    const app = await приложение();

    const за1 = await request(app).get("/api/pricing/events/by-type?types=cta_click&days=1");
    const за3 = await request(app).get("/api/pricing/events/by-type?types=cta_click&days=3");
    const за7 = await request(app).get("/api/pricing/events/by-type?types=cta_click&days=7");

    expect(за1.body.поТипу.cta_click.всего, "окно в сутки захватило лишнее").toBe(1);
    expect(за3.body.поТипу.cta_click.всего).toBe(2);
    expect(за7.body.поТипу.cta_click.всего).toBe(3);
    // Главное утверждение: окна РАЗЛИЧАЮТСЯ. Прежде все три давали одно число.
    expect(new Set([за1.body.поТипу.cta_click.всего, за7.body.поТипу.cta_click.всего]).size).toBe(2);
  });

  it("🔴 автоматика названа числом: иначе её читают как людей", async () => {
    /*
     * Мой собственный промах 09.10.2026: спросил тут `page_view` за утро,
     * получил 92 при «наших» 1 и прочитал как 91 живого человека. Сводка дня на
     * тех же событиях дала визитов ВСЕГО 3 — потому что 113 событий из 117
     * отсеялись по признаку управляемого браузера. Здесь отсева не было вовсе,
     * и соседние окна читают эту ручку для шахматных ступеней — значит ошибка
     * тиражировалась.
     */
    журнал([
      { type: "page_view", ts: сутокНазад(0), sid: "человек", path: "/" },
      { type: "page_view", ts: сутокНазад(0), sid: "наш", path: "/?c=probe-okno" },
      { type: "page_view", ts: сутокНазад(0), sid: "робот", path: "/", webdriver: true },
      { type: "page_view", ts: сутокНазад(0), sid: "робот2", path: "/", ua: "Mozilla/5.0 HeadlessChrome/120" },
    ]);
    const r = await request(await приложение()).get(
      "/api/pricing/events/by-type?types=page_view&days=1",
    );
    expect(r.status).toBe(200);
    const п = r.body.поТипу.page_view;
    expect(п.всего, "сырое число изменилось — по нему сравнивают дни").toBe(4);
    expect(п.наши).toBe(1);
    expect(п.автоматика, "автоматика не названа").toBe(2);
    // Живое считается вычитанием, и способ назван словами в самом ответе.
    expect(п.всего - п.наши - п.автоматика).toBe(1);
    expect(r.body.единицы).toMatch(/всего − наши − автоматика/);
  });

  it("🔴 негодное days — отказ, а не тихое «сегодня»", async () => {
    const app = await приложение();
    for (const плохое of ["ноль", "0", "-3", "1.5", "1000"]) {
      const r = await request(app).get(`/api/pricing/events/by-type?types=cta_click&days=${плохое}`);
      expect(r.status, `days=${плохое} принят молча`).toBe(400);
      expect(r.body.error).toBe("bad_days");
    }
  });

  it("🔴 день считается по Алматы, как в сводке дня, а не по UTC", async () => {
    /*
     * Событие в 02:00 по Алматы — это 21:00 ПРЕДЫДУЩИХ суток UTC. Прежняя
     * ручка относила его к вчерашнему дню, сводка `/day` — к сегодняшнему.
     * Теперь обе отвечают одинаково, и это проверяется сравнением их чисел.
     */
    const сегодня = сегодняАлматы();
    const вНочьПоАлматы = `${сегодня}T21:00:00.000Z`; // 02:00 следующего дня Алматы
    const завтраАлматы = new Date(Date.parse(`${сегодня}T00:00:00.000Z`) + 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    журнал([{ type: "page_view", ts: вНочьПоАлматы, sid: "ночной", path: "/" }]);
    const app = await приложение();

    const поТипам = await request(app).get(
      `/api/pricing/events/by-type?types=page_view&day=${завтраАлматы}&days=1`,
    );
    const сводка = await request(app).get(`/api/pricing/events/day?date=${завтраАлматы}`);

    expect(поТипам.body.поТипу.page_view.всего, "ручки разошлись в определении дня").toBe(
      сводка.body.визиты.всего,
    );
    expect(поТипам.body.поТипу.page_view.всего).toBe(1);
  });

  it("период назван в ответе словами — иначе «сегодня» сравнят с «вчера»", async () => {
    журнал([{ type: "page_view", ts: сутокНазад(0), sid: "с", path: "/" }]);
    const r = await request(await приложение()).get(
      "/api/pricing/events/by-type?types=page_view&days=3",
    );
    expect(r.body.дней).toBe(3);
    expect(r.body.период.зона).toMatch(/Almaty/);
    expect(r.body.период.зона, "не сказано, что сегодняшний день неполон").toMatch(/неполон/);
  });

  it("КОНТРОЛЬ: без days ручка по-прежнему отвечает за один день", async () => {
    журнал([
      { type: "page_view", ts: сутокНазад(0), sid: "a", path: "/" },
      { type: "page_view", ts: сутокНазад(3), sid: "b", path: "/" },
    ]);
    const r = await request(await приложение()).get("/api/pricing/events/by-type?types=page_view");
    expect(r.body.дней).toBe(1);
    expect(r.body.поТипу.page_view.всего).toBe(1);
  });
});
