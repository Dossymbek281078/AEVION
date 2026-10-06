import { describe, test, expect, afterAll, vi } from "vitest";
import request from "supertest";
import express from "express";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

/**
 * «ДОШЛИ ДО ЦЕН» СЧИТАЕТ УНИКАЛЬНЫЕ СЕССИИ, А НЕ ПРОСМОТРЫ — И ЭТО ОХРАНЯЕТСЯ.
 *
 * 🔴 НАЙДЕНО ПРИЁМКОЙ 06.10.2026, уже ПОСЛЕ выкатки волны 19. Сама починка
 * приехала с ветвью воронки и верна: до неё в одном объекте жили две единицы —
 * `visits` считал сессии, а `pricing` КАЖДЫЙ просмотр страницы цен. Человек,
 * открывший цены трижды, давал «1 визит и 3 до цен», и доля доходимости
 * выходила за 100 %; читающий отчёт об этом не знал.
 *
 * Но НАДЗОРА у починки не было. Проверено мутацией против ВСЕХ шестнадцати
 * сторожей воронки (`funnel|byPost|events`): обход дедупа и у канала
 * (`if (!виденныеСессии.has(ключЦен))` → `if (true)`), и у поста
 * (`ключЦенПоста`) прошёл ЗЕЛЕНО оба раза. То есть вернуть «больше 100 %»
 * можно было молча, и ближайший сторож этого бы не заметил.
 *
 * Почему соседи были слепы, хотя этот путь исполняют: у них все события из
 * РАЗНЫХ сессий, а при разных сессиях дедуп ничего не меняет. Различать
 * просмотры и сессии умеют только данные, где одна сессия приходит ДВАЖДЫ.
 *
 * Запрос делается К РУЧКЕ и читается ТЕЛО ответа: 30.09 разрезы уже считались
 * верно и НЕ попадали в res.json — функция была права, ручка молчала.
 */

const каталог = mkdtempSync(join(tmpdir(), "aevion-pricing-sessions-"));
const ФАЙЛ = join(каталог, "events.jsonl");

// ДО импорта маршрута: путь хранилища читается при загрузке модуля.
process.env.EVENTS_FILE = ФАЙЛ;

vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: vi.fn() }) }));
vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => vi.fn() }));

const { eventsRouter } = await import("../src/routes/events");

function приложение() {
  const a = express();
  a.use(express.json());
  a.use("/api/pricing/events", eventsRouter);
  return a;
}

const ПЕРЕВОД = String.fromCharCode(10); // эскейп съедается на границе вызова (§2е)

/**
 * Данные подобраны так, чтобы счёт по сессиям и счёт по просмотрам давали
 * РАЗНЫЕ числа. Без этого сторож зеленел бы и на прежнем коде.
 *
 *   s-1: заход + цены + цены ещё раз  -> одна сессия, ДВА просмотра цен
 *   s-2: заход + цены                 -> вторая сессия, один просмотр
 *
 * Значит: по сессиям pricing = 2, по просмотрам = 3. Разница и есть предмет.
 * Канал и пост у всех один, чтобы проверить ОБА места дедупа сразу.
 */
const СОБЫТИЯ = [
  { type: "page_view", path: "/",        sid: "s-1", meta: { channel: "mail-outreach", post: "ai7" } },
  { type: "page_view", path: "/pricing", sid: "s-1", meta: { channel: "mail-outreach", post: "ai7" } },
  { type: "page_view", path: "/pricing", sid: "s-1", meta: { channel: "mail-outreach", post: "ai7" } },
  { type: "page_view", path: "/",        sid: "s-2", meta: { channel: "mail-outreach", post: "ai7" } },
  { type: "page_view", path: "/pricing", sid: "s-2", meta: { channel: "mail-outreach", post: "ai7" } },
];

// Поле времени называется ts (НЕ at): с «at» события молча выпадают по окну дат,
// знаменатель приходит 0, и это читается как дефект ручки.
const сейчас = new Date().toISOString();
writeFileSync(
  ФАЙЛ,
  СОБЫТИЯ.map((e) => JSON.stringify({ ...e, ts: сейчас, ua: "Mozilla/5.0 Chrome/131" })).join(ПЕРЕВОД) + ПЕРЕВОД,
  "utf8",
);

afterAll(() => rmSync(каталог, { recursive: true, force: true }));

type Разрез = { visits: number; pricing: number };
type Тело = {
  byChannel?: Record<string, Разрез>;
  byPost?: Record<string, Разрез>;
  byPostVisitsNote?: string;
};

async function воронка(): Promise<Тело> {
  const ответ = await request(приложение()).get("/api/pricing/events/funnel?days=3");
  expect(ответ.status, "ручка воронки не ответила 200").toBe(200);
  return ответ.body as Тело;
}

describe("«дошли до цен» — уникальные сессии, а не просмотры", () => {
  test("ЗНАМЕНАТЕЛЬ: разрезы вообще пришли из ручки", async () => {
    const тело = await воронка();
    const каналы = Object.keys(тело.byChannel ?? {});
    const посты = Object.keys(тело.byPost ?? {});
    process.stderr.write(
      `[сторож] каналов в ТЕЛЕ: ${каналы.length} (${каналы.join(", ")}); ` +
        `постов: ${посты.length} (${посты.join(", ")})` + ПЕРЕВОД,
    );
    // Ноль ключей означает, что разрез не доехал до res.json — дефект 30.09.
    expect(каналы.length, "byChannel не пришёл в тело ответа").toBeGreaterThanOrEqual(1);
    expect(посты.length, "byPost не пришёл в тело ответа").toBeGreaterThanOrEqual(1);
  });

  test("КАНАЛ: два просмотра цен одной сессией — одно «дошли до цен»", async () => {
    const тело = await воронка();
    expect(
      тело.byChannel?.["mail-outreach"]?.pricing,
      "pricing у канала считает ПРОСМОТРЫ, а visits сессии — одно слово, две единицы, " +
        "и доля доходимости снова уйдёт за 100 %",
    ).toBe(2);
  });

  test("ПОСТ: то же у разреза по постам", async () => {
    const тело = await воронка();
    expect(
      тело.byPost?.["mail-outreach/ai7"]?.pricing,
      "pricing у поста считает просмотры — второе место дедупа осталось без надзора",
    ).toBe(2);
  });

  test("КОНТРОЛЬ: единица у visits и pricing ОДНА", async () => {
    // Иначе починка «считать сессии» могла бы превратиться в «считать один раз
    // навсегда»: тогда pricing сравнялся бы с единицей, а не с числом сессий.
    const тело = await воронка();
    expect(тело.byChannel?.["mail-outreach"]?.visits, "визиты канала считаются не по сессиям").toBe(2);
    expect(тело.byPost?.["mail-outreach/ai7"]?.visits, "визиты поста считаются не по сессиям").toBe(2);
  });

  test("пометка НАЗЫВАЕТ единицу — иначе читающий снова не узнает", async () => {
    /*
     * Половина дефекта была не в числах, а в молчании: единицу поменяли, а
     * читающий отчёт об этом узнать не мог. Проверяем, что пометка существует и
     * говорит про сессии, не требуя дословной фразы (дословные сторожа краснеют
     * на починке — проверено на себе в этот же день).
     */
    const тело = await воронка();
    const пометка = String(тело.byPostVisitsNote ?? "");
    expect(пометка.length, "пометки про единицу byPost нет вовсе").toBeGreaterThan(40);
    expect(пометка.toLowerCase(), "пометка не называет единицу «сессии»").toContain("сесси");

    /*
     * ⚠️ ПРОВЕРЕНО НА СЕБЕ: простого `toContain("pricing")` НЕ ХВАТАЕТ. Убрал
     * мутацией всю фразу «pricing здесь и в byChannel — ТОЖЕ уникальные
     * сессии», и проверка осталась ЗЕЛЁНОЙ — потому что слово «pricing» живёт в
     * пометке ещё и внутри `pricingOurs`. Подстрока имени поля выглядела как
     * утверждение о единице.
     *
     * Поэтому: убираем из текста имена полей, а потом требуем, чтобы рядом с
     * оставшимся «pricing» стояло слово «сесси». Так проверяется СВЯЗЬ двух
     * понятий, а не присутствие буквосочетания, и дословная фраза не навязана —
     * автор вправе её переписать.
     */
    const безИмёнПолей = пометка.toLowerCase().split("pricingours").join(" ");
    const где = безИмёнПолей.indexOf("pricing");
    expect(
      где,
      "пометка молчит про pricing, хотя его единица сменилась с просмотров на сессии",
    ).toBeGreaterThanOrEqual(0);
    const окрестности = безИмёнПолей.slice(Math.max(0, где - 60), где + 160);
    expect(
      окрестности,
      "про pricing сказано, но не сказано, что это СЕССИИ — читающий снова не узнает единицу",
    ).toContain("сесси");
  });
});
