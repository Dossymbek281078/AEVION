import { describe, test, expect, beforeEach, afterAll } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import express from "express";

/**
 * 🔴 Воронка обязана считать ЛЮДЕЙ, а нашу автоматику называть отдельно.
 *
 * ЗАМЕР 20.09.2026 по 200 последним событиям прода: 183 из 200 (91 %) прислали
 * не люди — 59 помеченных зондов `AEVION-probe/1.0` и 124 безымянных
 * HeadlessChrome. На деньгах это выглядело так: `checkout_start` за сутки 47,
 * покупок 0 — и читалось как провал конверсии. На самом деле ВСЕ 47 начали
 * зонды, а настоящих начатых оплат было ноль. Решение по такой панели
 * принимать нельзя: она показывает нашу собственную тень и зовёт её спросом.
 *
 * Отдельно стережём ОТРИЦАТЕЛЬНЫЙ контроль: обычный браузер НЕ должен попасть
 * в роботы. Фильтр, съедающий живых покупателей, хуже отсутствия фильтра —
 * он сделает воронку пустой и это спишут на «нет трафика».
 */

const TMP = mkdtempSync(join(tmpdir(), "aevion-events-bots-"));
const FILE = join(TMP, "events.jsonl");
process.env.EVENTS_FILE = FILE;
delete process.env.ADMIN_TOKEN;

const { eventsRouter, видОтправителя } = await import("../src/routes/events");

const ЧЕЛОВЕК_WIN =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
const ЧЕЛОВЕК_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const ЗОНД = ЧЕЛОВЕК_WIN + " AEVION-probe/1.0";
const HEADLESS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.7922.34 Safari/537.36";

function app() {
  const a = express();
  a.use(express.json());
  a.use("/api/pricing/events", eventsRouter);
  return a;
}

function write(events: Record<string, unknown>[]) {
  writeFileSync(
    FILE,
    events.map((e) => JSON.stringify({ ts: new Date().toISOString(), ...e })).join("\n") + "\n",
    "utf8",
  );
}

beforeEach(() => writeFileSync(FILE, "", "utf8"));
afterAll(() => rmSync(TMP, { recursive: true, force: true }));

describe("вид отправителя различает автоматику и человека", () => {
  test("наш помеченный зонд опознаётся", () => {
    expect(видОтправителя(ЗОНД)).toBe("probe");
  });

  test("вторая семья наших зондов тоже опознаётся", () => {
    // Живой случай 20.09.2026: фильтр знал только `AEVION-probe`, а в данных
    // прода нашлась `AEVION-checkout-gate-probe` — 24 события, среди них ВСЕ
    // шесть «человеческих» начатых оплат за двое суток. Перечень известных
    // имён подводит при первой же новой пробе; признак берём общий.
    expect(
      видОтправителя(
        "Mozilla/5.0 (compatible; AEVION-checkout-gate-probe/1.0; +https://aevion.app)",
      ),
    ).toBe("probe");
  });

  test("headless-браузер опознаётся, хотя метки у него нет", () => {
    expect(видОтправителя(HEADLESS)).toBe("headless");
  });

  test("роботы и инструменты командной строки опознаются", () => {
    expect(видОтправителя("Googlebot/2.1 (+http://www.google.com/bot.html)")).toBe("bot");
    expect(видОтправителя("curl/8.4.0")).toBe("bot");
    expect(видОтправителя("python-requests/2.31.0")).toBe("bot");
  });

  test("ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ: обычный браузер не считается роботом", () => {
    expect(видОтправителя(ЧЕЛОВЕК_WIN)).toBeNull();
    expect(видОтправителя(ЧЕЛОВЕК_IPHONE)).toBeNull();
    // Cubot — настоящая марка телефонов, и в её UA есть буквы «bot». Требование
    // границы слова слева отличает её от Googlebot: покупатель с таким телефоном
    // не должен исчезнуть из воронки.
    expect(
      видОтправителя(
        "Mozilla/5.0 (Linux; Android 12; Cubot X30) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
      ),
    ).toBeNull();
  });

  test("пустой UA — это НЕ робот, а неизвестность: старые записи не переписываем", () => {
    expect(видОтправителя("")).toBeNull();
    expect(видОтправителя(undefined)).toBeNull();
  });
});

describe("сводка считает людей, а автоматику называет отдельно", () => {
  test("зондовые начатые оплаты не попадают в воронку", async () => {
    write([
      { type: "checkout_start", source: "pricing", tier: "lite", sid: "a", ua: ЗОНД },
      { type: "checkout_start", source: "pricing", tier: "lite", sid: "b", ua: ЗОНД },
      { type: "page_view", source: "pricing", sid: "c", ua: HEADLESS },
      { type: "checkout_start", source: "pricing", tier: "pro", sid: "d", ua: ЧЕЛОВЕК_WIN },
      { type: "page_view", source: "go", sid: "e", ua: ЧЕЛОВЕК_IPHONE },
    ]);

    const r = await request(app()).get("/api/pricing/events/summary?hours=24");
    expect(r.status).toBe(200);

    // человеческое: одна начатая оплата и один просмотр
    expect(r.body.total).toBe(2);
    expect(r.body.byType.checkout_start).toBe(1);
    expect(r.body.byTier).toEqual({ pro: 1 });
    expect(r.body.bySource.go).toBe(1);

    // автоматика названа, а не выброшена молча
    expect(r.body.countsExclude).toBe("automated");
    expect(r.body.automatedEvents).toBe(3);
    expect(r.body.automatedByKind).toEqual({ probe: 2, headless: 1 });
  });

  test("ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ: без автоматики ничего не теряется", async () => {
    write([
      { type: "checkout_start", source: "pricing", tier: "lite", sid: "a", ua: ЧЕЛОВЕК_WIN },
      { type: "page_view", source: "pricing", sid: "b", ua: ЧЕЛОВЕК_IPHONE },
    ]);
    const r = await request(app()).get("/api/pricing/events/summary?hours=24");
    expect(r.body.total).toBe(2);
    expect(r.body.automatedEvents).toBe(0);
    expect(r.body.automatedByKind).toEqual({});
  });

  test("события без UA считаются людьми, но их число названо", async () => {
    write([
      { type: "page_view", source: "pricing", sid: "a" },
      { type: "page_view", source: "pricing", sid: "b", ua: ЧЕЛОВЕК_WIN },
    ]);
    const r = await request(app()).get("/api/pricing/events/summary?hours=24");
    expect(r.body.total).toBe(2);
    expect(r.body.withoutUa).toBe(1);
  });
});
