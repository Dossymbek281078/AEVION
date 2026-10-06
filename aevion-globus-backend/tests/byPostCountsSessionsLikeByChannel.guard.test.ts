import { describe, test, expect, afterAll, vi } from "vitest";
import request from "supertest";
import express from "express";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

/**
 * РАЗРЕЗ byPost СЧИТАЕТ ТУ ЖЕ ЕДИНИЦУ, ЧТО byChannel И ИТОГ, И ГОВОРИТ ОБ ЭТОМ.
 *
 * Повод 05.10.2026, прислало окно ДАННЫЕ (user-2b). В ответе /funnel у byChannel и
 * byHour есть собственные пометки про единицу, а у byPost не было. На живых числах
 * это дало расхождение: byChannel для mail-outreach — 2, byPost по тем же меткам — 3
 * (ai1: 1, ai3: 2). Окно истолковало это как «два человека против трёх визитов» и
 * было право по направлению, но взять это было негде.
 *
 * Причина нашлась в коде, а не в толковании: byChannel.visits дедуплицировал по
 * сессии, byPost.visits считал КАЖДЫЙ просмотр. Одно слово «visits» в одном ответе
 * означало две разные вещи — тот же дефект, который 30.09 чинили у byChannel
 * (167 против 519). Единица приведена к общей; пометка добавлена рядом с соседними.
 *
 * Запрос делается К РУЧКЕ и читается ТЕЛО ответа: 30.09 разрезы byPost/byEntryPage
 * уже считались верно и НЕ попадали в res.json — функция была права, ручка молчала.
 */

const каталог = mkdtempSync(join(tmpdir(), "aevion-bypost-"));
const ФАЙЛ = join(каталог, "events.jsonl");

// ДО импорта маршрута: путь хранилища читается при загрузке модуля. Статический
// import здесь уехал бы выше присваивания и дал бы зелёный прогон на пустом файле.
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
 * Данные подобраны так, чтобы РАЗЛИЧАТЬ просмотры и сессии. Без этого сторож
 * зеленел бы и на прежнем коде — проверено мутацией.
 *   пост ai3: ОДНА сессия, ДВА просмотра  -> visits 1 при счёте по сессиям, 2 по просмотрам
 *   пост ai1: ДВЕ разные сессии           -> visits 2 в обоих случаях (контроль, что не схлопываем лишнее)
 */
const СОБЫТИЯ = [
  { type: "page_view", path: "/", sid: "s-1", meta: { channel: "mail-outreach", post: "ai3" } },
  { type: "page_view", path: "/pricing", sid: "s-1", meta: { channel: "mail-outreach", post: "ai3" } },
  { type: "page_view", path: "/", sid: "s-2", meta: { channel: "mail-outreach", post: "ai1" } },
  { type: "page_view", path: "/", sid: "s-3", meta: { channel: "mail-outreach", post: "ai1" } },
];

// Поле времени называется ts (НЕ at): с «at» все события молча выпадают по окну дней,
// знаменатель приходит 0 и это читается как дефект ручки. Поймано на себе 05.10.
const сейчас = new Date().toISOString();
writeFileSync(
  ФАЙЛ,
  СОБЫТИЯ.map((e) => JSON.stringify({ ...e, ts: сейчас, ua: "Mozilla/5.0 Chrome/131" })).join(ПЕРЕВОД) + ПЕРЕВОД,
  "utf8",
);

afterAll(() => rmSync(каталог, { recursive: true, force: true }));

type Разрез = { visits: number; pricing: number; checkoutStart: number; paid: number };
type Тело = {
  byPost?: Record<string, Разрез>;
  byChannel?: Record<string, { visits: number }>;
  byPostVisitsNote?: string;
};

async function воронка(): Promise<Тело> {
  const ответ = await request(приложение()).get("/api/pricing/events/funnel?days=3");
  expect(ответ.status, "ручка воронки не ответила 200").toBe(200);
  return ответ.body as Тело;
}

describe("byPost: единица та же, что у byChannel, и она названа", () => {
  test("ЗНАМЕНАТЕЛЬ: сколько ключей byPost пришло из ручки", async () => {
    const тело = await воронка();
    const ключи = Object.keys(тело.byPost ?? {});
    process.stderr.write(
      `[сторож] ключей byPost в ТЕЛЕ ответа: ${ключи.length} (${ключи.join(", ")})` + ПЕРЕВОД,
    );
    // Ноль ключей означает, что разрез не доехал до res.json, — ровно дефект 30.09.
    expect(ключи.length, "byPost не пришёл в тело ответа").toBeGreaterThanOrEqual(2);
  });

  test("два просмотра ОДНОЙ сессии по одному посту — это один визит", async () => {
    const тело = await воронка();
    expect(
      тело.byPost?.["mail-outreach/ai3"]?.visits,
      "byPost считает просмотры, а byChannel сессии — одно слово, две единицы",
    ).toBe(1);
  });

  test("КОНТРОЛЬ: две РАЗНЫЕ сессии по одному посту — два визита", async () => {
    const тело = await воронка();
    // Иначе починка «считать сессии» превратилась бы в «считать посты»: единица
    // стала бы верной, а число — всегда единицей.
    expect(тело.byPost?.["mail-outreach/ai1"]?.visits, "разные сессии схлопнуты в одну").toBe(2);
  });

  test("сумма byPost по каналу не больше визитов самого канала", async () => {
    const тело = await воронка();
    const поКаналу = Object.entries(тело.byPost ?? {})
      .filter(([к]) => к.startsWith("mail-outreach/"))
      .reduce((с, [, v]) => с + v.visits, 0);
    const канал = тело.byChannel?.["mail-outreach"]?.visits ?? 0;
    process.stderr.write(`[сторож] byPost сумма ${поКаналу} против byChannel ${канал}` + ПЕРЕВОД);
    expect(поКаналу, "сумма по постам превысила визиты канала — единицы снова разошлись").toBeLessThanOrEqual(
      канал,
    );
  });

  test("пометка про единицу есть в ТЕЛЕ и называет сессии", async () => {
    const тело = await воронка();
    expect(тело.byPostVisitsNote, "пометки byPostVisitsNote нет в ответе").toBeTruthy();
    expect(тело.byPostVisitsNote, "пометка не называет единицу").toMatch(/СЕССИИ/);
  });
});
