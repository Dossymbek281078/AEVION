import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express from "express";
import request from "supertest";

/*
 * 🔴 РАЗРЕЗ ЧАСОВ ДОЛЖЕН НАЗЫВАТЬ, С КАКОГО ЧАСА СТУПЕНЬ ИЗМЕРЯЕТСЯ.
 *
 * Повод в ночь 11→12.10.2026: оркестратор попросил сводку по человеческим
 * ступеням за календарный день, и выяснилось, что «с какого часа ступень
 * включилась» назвать НЕЧЕМ. В разрезе часов не было ни ступеней, ни оси
 * «наши» — поля там были только hour/visits/pricing/checkoutStart/
 * checkoutStartOurs/thankYouOpened/paid/paidOurs. Час включения приходилось
 * брать со слов выкатившего окна, то есть не замером.
 *
 * Почему это не косметика. Читатель воронки считает по журналу НАЗАД, поэтому
 * поздняя выкатка бэкенда ничего не теряет. Ноль возникает только до часа
 * выкатки ОТПРАВИТЕЛЯ (сайта), и тогда он значит «не измерялось», а не «никто
 * не сделал». Два этих ответа читаются одинаково, если часа нет, — и я на этом
 * уже один раз назвал исправный учёт слепым.
 *
 * ⚠️ Самая важная проверка здесь — вторая: час, в котором был ТОЛЬКО шаг и ни
 * одного просмотра страницы. Прежний фильтр пропускал час по визитам, ценам,
 * кассе и оплате, поэтому такой час выпадал из ответа ЦЕЛИКОМ — то есть ровно
 * тот час, по которому и определяется включение ступени, терялся молча. В жизни
 * такой час бывает постоянно: сессия началась в 10:58, задачу решили в 11:03.
 */
const каталог = mkdtempSync(join(tmpdir(), "aevion-hour-steps-"));
const файл = join(каталог, "events.jsonl");
process.env.EVENTS_FILE = файл;

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";

const ЧАС_МС = 3600_000;
// База — шесть часов назад: внутри окна days=1 и заведомо в прошлом, поэтому
// прогон не зависит от того, в какую минуту суток его запустили.
const база = Date.now() - 6 * ЧАС_МС;
const вМоментЧаса = (н: number) => new Date(база + н * ЧАС_МС).toISOString();
const ключЧаса = (н: number) => new Date(база + н * ЧАС_МС).toISOString().slice(0, 13);

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

/** Просмотр в указанном часе; `наш` помечает заход меткой пробы окна. */
function просмотр(sid: string, н: number, наш = false) {
  return {
    type: "page_view",
    ts: вМоментЧаса(н),
    sid,
    path: наш ? "/cyberchess?c=probe-okno" : "/cyberchess?c=yt",
    meta: { channel: "youtube" },
  };
}

function шаг(sid: string, н: number, тип: string, meta?: Record<string, unknown>) {
  return { type: тип, ts: вМоментЧаса(н), sid, path: "/cyberchess", meta };
}

async function часы() {
  const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
  expect(r.status).toBe(200);
  const список = r.body.byHour as Array<Record<string, number | string>>;
  expect(Array.isArray(список), "byHour перестал быть массивом").toBe(true);
  const поКлючу: Record<string, Record<string, number>> = {};
  for (const строка of список) поКлючу[String(строка.hour)] = строка as Record<string, number>;
  return { тело: r.body, поКлючу, список };
}

describe("разрез часов называет час включения ступени", () => {
  it("🔴 человеческие ступени есть в строке часа, и наши отделены", async () => {
    журнал([
      просмотр("живой", 0),
      шаг("живой", 0, "game_progress", { plies: 3 }),
      шаг("живой", 0, "puzzle_solved"),
      просмотр("наш", 0, true),
      шаг("наш", 0, "game_progress", { plies: 3 }),
    ]);
    const { поКлючу } = await часы();
    const ч = поКлючу[ключЧаса(0)];
    expect(ч, "часа с событиями нет в ответе").toBeTruthy();
    expect(ч.visits).toBe(2);
    expect(ч.visitsOurs, "ось «наши» у визитов по часам не появилась").toBe(1);
    expect(ч.progressed).toBe(2);
    expect(ч.progressedOurs, "наша проба в пороге не отделена").toBe(1);
    expect(ч.progressed - ч.progressedOurs, "живых по порогу вышло не столько").toBe(1);
    expect(ч.puzzleSolved).toBe(1);
    expect(ч.puzzleSolvedOurs).toBe(0);
  });

  it("🔴 ЧАС ТОЛЬКО СО ШАГОМ не выпадает из ответа", async () => {
    /*
     * Носитель признака: сессия входит в часе 2, а задачу решает в часе 3, где
     * нет ни одного page_view. Без этой проверки мутация фильтра («оставить
     * прежнее условие по визитам») выжила бы — именно так я трижды за смену
     * получал зелёный прогон на пустом стороже.
     */
    журнал([просмотр("сквозь", 2), шаг("сквозь", 3, "puzzle_solved")]);
    const { поКлючу } = await часы();
    const вход = поКлючу[ключЧаса(2)];
    const сШагом = поКлючу[ключЧаса(3)];
    expect(вход, "часа входа нет").toBeTruthy();
    expect(вход.visits).toBe(1);
    expect(вход.puzzleSolved, "шаг приписан часу входа, а не своему часу").toBe(0);
    expect(
      сШагом,
      "ЧАС СО ШАГОМ БЕЗ ВИЗИТОВ ВЫПАЛ ИЗ ОТВЕТА — час включения назвать нечем",
    ).toBeTruthy();
    expect(сШагом.puzzleSolved).toBe(1);
    expect(сШагом.visits, "в часе шага визитов быть не должно").toBe(0);
  });

  it("🔴 первый непустой час и есть час включения: до него ступени нет", async () => {
    // Отправитель «заработал» в часе 4: до него ступень пуста при живых визитах.
    журнал([
      просмотр("а", 1),
      просмотр("б", 2),
      просмотр("в", 4),
      шаг("в", 4, "waitlist_offer_shown"),
    ]);
    const { поКлючу } = await часы();
    expect(поКлючу[ключЧаса(1)].offerShown, "ступень появилась раньше своего часа").toBe(0);
    expect(поКлючу[ключЧаса(2)].offerShown).toBe(0);
    expect(поКлючу[ключЧаса(4)].offerShown, "в часе включения ступень пуста").toBe(1);
    const первыйСПоказом = Object.keys(поКлючу)
      .sort()
      .find((к) => поКлючу[к].offerShown > 0);
    expect(первыйСПоказом, "первый час с показом определяется не тем часом").toBe(ключЧаса(4));
  });

  it("единица — сессия В ПРЕДЕЛАХ часа: три события одной сессии дают один", async () => {
    журнал([
      просмотр("один", 0),
      шаг("один", 0, "game_progress", { plies: 1 }),
      шаг("один", 0, "game_progress", { plies: 3 }),
      шаг("один", 0, "game_progress", { plies: 11 }),
    ]);
    const { поКлючу } = await часы();
    expect(поКлючу[ключЧаса(0)].progressed, "события сложились вместо сессии").toBe(1);
  });

  it("все четыре ступени отделяют наших, каждая по отдельности", async () => {
    журнал([
      просмотр("живой", 0),
      шаг("живой", 0, "game_progress", { plies: 3 }),
      шаг("живой", 0, "puzzle_solved"),
      шаг("живой", 0, "waitlist_offer_shown"),
      шаг("живой", 0, "waitlist_submit"),
      просмотр("наш", 0, true),
      шаг("наш", 0, "game_progress", { plies: 3 }),
      шаг("наш", 0, "puzzle_solved"),
      шаг("наш", 0, "waitlist_offer_shown"),
      шаг("наш", 0, "waitlist_submit"),
    ]);
    const { поКлючу } = await часы();
    const ч = поКлючу[ключЧаса(0)];
    for (const имя of ["progressed", "puzzleSolved", "offerShown", "waitlistSubmitted"]) {
      expect(ч[имя], "ступень " + имя + " не досчитана").toBe(2);
      expect(ч[имя + "Ours"], "у ступени " + имя + " наши не отделены").toBe(1);
      expect(ч[имя] - ч[имя + "Ours"], "живых по " + имя + " вышло не столько").toBe(1);
    }
  });

  it("КОНТРОЛЬ: внимание (engaged) ступенью НЕ считается", async () => {
    /*
     * Обходчик, подождавший десять секунд, даёт `engaged`. Если бы внимание
     * попало в ступени или в фильтр часов, машинная пара дала бы «час
     * включения» человеческого шага — и отсев обходчика мы бы включили по
     * ложному числу.
     */
    журнал([{ type: "engaged", ts: вМоментЧаса(5), sid: "ждал", path: "/cyberchess" }]);
    const { поКлючу, список } = await часы();
    expect(
      поКлючу[ключЧаса(5)],
      "час с одним только вниманием попал в ответ как ступень",
    ).toBeFalsy();
    expect(список.length, "ответ не пуст, хотя человеческих шагов не было").toBe(0);
  });

  it("КОНТРОЛЬ: событие без sid ступень не создаёт", async () => {
    журнал([
      просмотр("живой", 0),
      { type: "puzzle_solved", ts: вМоментЧаса(0), path: "/cyberchess" },
    ]);
    const { поКлючу } = await часы();
    expect(поКлючу[ключЧаса(0)].puzzleSolved, "шаг без сессии приписан человеку").toBe(0);
  });

  it("🔴 оговорки об оси и о часе включения стоят В ОТВЕТЕ", async () => {
    // Иначе их прочтёт только тот, кто откроет исходник, а числа читают из тела.
    журнал([просмотр("живой", 0), шаг("живой", 0, "puzzle_solved")]);
    const { тело } = await часы();
    expect(String(тело.byHourUnits)).toMatch(/уникальная сессия В ПРЕДЕЛАХ часа/);
    expect(String(тело.byHourUnits)).toMatch(/Ours/);
    expect(String(тело.byHourStepsNote)).toMatch(/час включения/);
    expect(String(тело.byHourStepsNote)).toMatch(/не измерялось/);
    expect(String(тело.byHourStepsNote), "оговорка про engaged потерялась").toMatch(/engaged/);
  });
});
