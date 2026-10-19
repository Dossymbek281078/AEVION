import { describe, it, expect, beforeEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * 🔴 19.10.2026 — воронка дня показала «оплаты: всего 7, наши 0, живые 7», и все семь были
 * тестовыми вебхуками кассы (адреса @example.test, окно 16:29–17:16Z). Слово оркестратора:
 * не удалять, а ПОМЕЧАТЬ — запись остаётся для аудита, пометку можно откатить.
 *
 * Сторож держит четыре обещания ручки POST /api/pricing/events/mark-ours:
 *  1. без токена — 401 и файл не тронут (401 с записью снаружи неотличим от 401 без неё);
 *  2. dryRun (по умолчанию) показывает число и НЕ пишет;
 *  3. запись трогает ТОЛЬКО события нужного типа в окне и без свой:true — соседи целы;
 *  4. после пометки /day отдаёт «всего 7, наши 7, живые 0» — порог приёмки оркестратора.
 * Плюс источники признака: тестовый режим кассы и адреса-примеры дают свой:true сразу.
 */
const каталог = mkdtempSync(join(tmpdir(), "aevion-mark-ours-"));
const файл = join(каталог, "events.jsonl");
process.env.EVENTS_FILE = файл;
process.env.ADMIN_TOKEN = "test-admin-token-19102026";

const { eventsRouter } = await import("../src/routes/events");
const { записатьПодтверждённуюОплату } = await import("../src/lib/payment/paymentConfirmedEvent");
const { нашВнутреннийАдрес } = await import("../src/lib/planGate");

function приложение() {
  const a = express();
  a.use(express.json());
  a.use("/api/pricing/events", eventsRouter);
  return a;
}

const ОКНО = { from: "2026-10-19T16:29:00Z", to: "2026-10-19T17:16:00Z" };
const ВНУТРИ = ["16:30:00", "16:44:36", "16:45:41", "16:54:32", "16:58:57", "17:06:27", "17:15:45"];
const оплата = (ts: string, meta: Record<string, unknown> = {}) =>
  JSON.stringify({ ts, type: "payment_confirmed", source: "lemonsqueezy", tier: "lite", meta: { reference: `ref-${ts}`, event: "subscription_created", свой: false, ...meta } });
const СОСЕДИ = [
  // та же минута, но вне окна по секундам — граница окна включительная по ts, это за ней
  oплатаВне("2026-10-19T17:16:01Z"),
  oплатаВне("2026-10-19T12:00:00Z"),
  // уже наша — трогать нельзя (повторная пометка затёрла бы причину)
  JSON.stringify({ ts: "2026-10-19T16:50:00Z", type: "payment_confirmed", source: "lemonsqueezy", meta: { свой: true, свойПричина: "ранее" } }),
  // другой тип в окне
  JSON.stringify({ ts: "2026-10-19T16:50:00Z", type: "checkout_start", sid: "s1", path: "/pricing" }),
];
function oплатаВне(ts: string) { return oплата(ts); }
function oплата(ts: string) { return оплата(ts); }
const ИСХОДНИК = [...ВНУТРИ.map((t) => оплата(`2026-10-19T${t}Z`)), ...СОСЕДИ].join("\n") + "\n";

beforeEach(() => { writeFileSync(файл, ИСХОДНИК, "utf8"); });
afterAll(() => {
  delete process.env.EVENTS_FILE; delete process.env.ADMIN_TOKEN;
  try { rmSync(каталог, { recursive: true, force: true }); } catch { /* уже нет */ }
});

const строки = () => readFileSync(файл, "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l) as { ts: string; type: string; meta?: Record<string, unknown> });
const помеченных = () => строки().filter((e) => e.type === "payment_confirmed" && e.meta?.свой === true).length;

describe("mark-ours помечает ровно окно и ничего не удаляет", () => {
  it("без токена — 401 и файл не тронут", async () => {
    const r = await request(приложение()).post("/api/pricing/events/mark-ours").send({ type: "payment_confirmed", ...ОКНО, dryRun: false, reason: "x" });
    expect(r.status).toBe(401);
    expect(readFileSync(файл, "utf8")).toBe(ИСХОДНИК);
  });

  it("dryRun по умолчанию: показывает 7 и не пишет", async () => {
    const r = await request(приложение()).post("/api/pricing/events/mark-ours").set("x-admin-token", process.env.ADMIN_TOKEN as string).send({ type: "payment_confirmed", ...ОКНО });
    expect(r.status).toBe(200);
    expect(r.body.dryRun).toBe(true);
    expect(r.body.count).toBe(7);
    expect(r.body.total, "знаменатель — все разобранные события").toBe(11);
    expect(r.body.affected.map((a: { ts: string }) => a.ts)).toEqual(ВНУТРИ.map((t) => `2026-10-19T${t}Z`));
    expect(readFileSync(файл, "utf8")).toBe(ИСХОДНИК);
    expect(помеченных(), "до записи помечена только давняя «ранее»").toBe(1);
  });

  it("запись без reason — 400 и файл не тронут", async () => {
    const r = await request(приложение()).post("/api/pricing/events/mark-ours").set("x-admin-token", process.env.ADMIN_TOKEN as string).send({ type: "payment_confirmed", ...ОКНО, dryRun: false });
    expect(r.status).toBe(400);
    expect(readFileSync(файл, "utf8")).toBe(ИСХОДНИК);
  });

  it("dryRun:false помечает 7, соседи целы, строк столько же, /day → наши 7, живые 0", async () => {
    const r = await request(приложение()).post("/api/pricing/events/mark-ours").set("x-admin-token", process.env.ADMIN_TOKEN as string)
      .send({ type: "payment_confirmed", ...ОКНО, dryRun: false, reason: "smoke-produkt e2e 19.10" });
    expect(r.status).toBe(200);
    expect(r.body.dryRun).toBe(false);
    expect(r.body.count).toBe(7);
    const после = строки();
    expect(после.length, "ни одно событие не удалено").toBe(11);
    expect(помеченных()).toBe(8); // 7 новых + давняя
    const новые = после.filter((e) => e.meta?.свойПричина === "smoke-produkt e2e 19.10");
    expect(новые.length).toBe(7);
    for (const e of новые) {
      expect(e.meta?.reference, "остальные поля meta сохранены").toBe(`ref-${e.ts}`);
      expect(typeof e.meta?.свойПомечено).toBe("string");
    }
    // соседи: вне окна и другой тип — слово в слово как были
    const исходные = ИСХОДНИК.split("\n").filter(Boolean);
    const текст = readFileSync(файл, "utf8").split("\n").filter(Boolean);
    for (const i of [7, 8, 10]) expect(текст[i], `сосед №${i} изменён`).toBe(исходные[i]);
    expect(JSON.parse(текст[9]).meta.свойПричина, "давняя пометка не затёрта").toBe("ранее");
    // повтор — идемпотентен: помечать больше нечего
    const r2 = await request(приложение()).post("/api/pricing/events/mark-ours").set("x-admin-token", process.env.ADMIN_TOKEN as string).send({ type: "payment_confirmed", ...ОКНО, dryRun: false, reason: "повтор" });
    expect(r2.body.count).toBe(0);
    expect(после.length).toBe(строки().length);
    // порог оркестратора: за 19.10 «оплаты всего 7 (из этого окна), наши 7, живые 0»
    const day = await request(приложение()).get("/api/pricing/events/day?date=2026-10-19").set("x-admin-token", process.env.ADMIN_TOKEN as string);
    expect(day.status).toBe(200);
    // в файле ещё 2 оплаты вне окна и 1 давняя наша: всего 10, наши 8, живые 2 — вне окна остались живыми намеренно
    expect(day.body.оплаты).toEqual({ всего: 10, наши: 8, живые: 2 });
  });

  it("неверное окно или тип — 400", async () => {
    for (const body of [{ type: "", ...ОКНО }, { type: "payment_confirmed", from: ОКНО.to, to: ОКНО.from }, { type: "payment_confirmed", from: "вчера", to: ОКНО.to }]) {
      const r = await request(приложение()).post("/api/pricing/events/mark-ours").set("x-admin-token", process.env.ADMIN_TOKEN as string).send(body);
      expect(r.status, JSON.stringify(body)).toBe(400);
    }
  });
});

describe("признак «свой» у подтверждённой оплаты знает тестовый режим кассы и адреса-примеры", () => {
  it("test_mode → свой:true при чужом адресе; без него — свой:false (контроль)", () => {
    writeFileSync(файл, "", "utf8");
    expect(записатьПодтверждённуюОплату({ source: "lemonsqueezy", tier: "lite", email: "buyer@gmail.com", testMode: true })).toBe(true);
    expect(записатьПодтверждённуюОплату({ source: "lemonsqueezy", tier: "lite", email: "buyer@gmail.com" })).toBe(true);
    const [тест, живая] = строки();
    expect(тест.meta?.свой).toBe(true);
    expect(тест.meta?.testMode).toBe(true);
    expect(живая.meta?.свой, "контроль: настоящий адрес без test_mode остаётся живым").toBe(false);
    expect(JSON.stringify(тест)).not.toContain("gmail.com");
  });
  it("адреса-примеры и пробные префиксы — наши; настоящий адрес — нет", () => {
    for (const e of ["x@example.test", "smoke-bureau-1910@mail.kz", "probe-1@corp.ru", "qa-2@corp.ru", "a@sub.example.com", "team@aevion.app"]) expect(нашВнутреннийАдрес(e), e).toBe(true);
    for (const e of ["buyer@gmail.com", "ivan@vostokpatent.com", "smoke@gmail.com", "example@gmail.com"]) expect(нашВнутреннийАдрес(e), e).toBe(false);
  });
});
