import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import { unsubToken, меткаДляЖурнала } from "../src/lib/waitlistUnsubToken";

/**
 * Заход на отписку записывается ДО попытки удаления и БЕЗ адреса.
 *
 * 🔴 Повод. 11.10.2026 отписка на свежем инстансе вообще не доходила до базы
 * (`ensureWaitlistTable()` не звалась, `dbAvailable` оставался false), и узнать,
 * сколько людей её просили, оказалось нечем: у нас успех не писал ничего, а у
 * провайдера статистику не прочитать — ключ Brevo отвергнут с 401 (проверено,
 * контроль: ключ Resend тем же заходом принят). Прошлое не восстановить,
 * поэтому хотя бы с этого момента просьба не теряется.
 *
 * Сторож проверяет ПОРЯДОК, а не только наличие строки: запись обязана лечь в
 * журнал раньше, чем в базу уйдёт DELETE. Иначе она теряется ровно в тех
 * случаях, ради которых нужна, — падение базы и обрыв процесса.
 */

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query }) }));
vi.mock("../src/lib/constitutionBrevo", () => ({
  sendWaitlistConfirm: vi.fn(async () => true),
  sendWeeklyDigestEmail: vi.fn(async () => ({ sent: 0 })),
}));

/** Одна лента событий: и строки журнала, и запросы в базу — чтобы видеть ПОРЯДОК. */
let лента: string[] = [];
let родной: { log: typeof console.log; warn: typeof console.warn; error: typeof console.error };

let ipSeq = 0;
async function приложение() {
  const { constitutionWaitlistRouter } = await import("../src/routes/constitutionWaitlist");
  const a = express();
  a.set("trust proxy", true);
  a.use((req, _res, next) => {
    ipSeq += 1;
    req.headers["x-forwarded-for"] = `10.9.${Math.floor(ipSeq / 250) % 250}.${(ipSeq % 250) + 1}`;
    next();
  });
  a.use(express.json());
  a.use("/api/constitution/waitlist", constitutionWaitlistRouter);
  return a;
}

const отписаться = async (email: string) =>
  request(await приложение())
    .get("/api/constitution/waitlist/unsubscribe")
    .query({ email, t: unsubToken(email)! });

beforeEach(() => {
  process.env.WAITLIST_UNSUB_SECRET = "test-unsub-secret-0123456789-abcdef";
  лента = [];
  родной = { log: console.log, warn: console.warn, error: console.error };
  const запиши = (p: string) => (...a: unknown[]) => void лента.push(p + a.map(String).join(" "));
  console.log = запиши("ЖУРНАЛ ");
  console.warn = запиши("ЖУРНАЛ ");
  console.error = запиши("ЖУРНАЛ ");
  query.mockReset();
  query.mockImplementation(async (sql: string) => {
    лента.push("БАЗА " + String(sql).trim().slice(0, 40));
    if (/^\s*CREATE TABLE/i.test(sql)) return { rows: [], rowCount: 0 };
    if (/^\s*DELETE/i.test(sql)) return { rows: [], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  });
});
afterEach(() => {
  console.log = родной.log;
  console.warn = родной.warn;
  console.error = родной.error;
});

const индексЗаписи = () => лента.findIndex((s) => s.includes("ОТПИСКА ЗАПРОШЕНА"));
const индексУдаления = () => лента.findIndex((s) => s.startsWith("БАЗА DELETE"));

describe("Заход на отписку: запись раньше удаления", () => {
  it("прибор видит предмет: в ленте есть и журнал, и запросы базы", async () => {
    const r = await отписаться("visit-probe-1@test.aev");
    expect(r.status).toBe(200);
    expect(лента.some((s) => s.startsWith("ЖУРНАЛ")), "журнал не перехвачен").toBe(true);
    expect(индексУдаления(), "DELETE не ушёл — не на чем проверять порядок").toBeGreaterThanOrEqual(0);
  });

  it("🔴 запись о заходе лежит РАНЬШЕ, чем DELETE уходит в базу", async () => {
    await отписаться("visit-probe-2@test.aev");
    const з = индексЗаписи();
    const у = индексУдаления();
    expect(з, "записи о заходе нет вовсе").toBeGreaterThanOrEqual(0);
    expect(у).toBeGreaterThanOrEqual(0);
    expect(з, `порядок нарушен: запись ${з}, удаление ${у}`).toBeLessThan(у);
  });

  it("🔴 запись есть даже когда база ПАДАЕТ — ради этого случая она и нужна", async () => {
    query.mockImplementation(async (sql: string) => {
      лента.push("БАЗА " + String(sql).trim().slice(0, 40));
      if (/^\s*CREATE TABLE/i.test(sql)) return { rows: [], rowCount: 0 };
      throw new Error("postgres упал");
    });
    const r = await отписаться("visit-probe-3@test.aev");
    expect(r.status).toBe(500);
    expect(индексЗаписи(), "база упала — и просьба человека потерялась").toBeGreaterThanOrEqual(0);
  });

  it("адреса в журнале нет НИ В ОДНОЙ строке, только метка", async () => {
    const email = "visit-probe-4@test.aev";
    await отписаться(email);
    const журнал = лента.filter((s) => s.startsWith("ЖУРНАЛ"));
    expect(журнал.length).toBeGreaterThan(0);
    for (const строка of журнал) {
      expect(строка, `адрес открытым текстом: ${строка.slice(0, 60)}`).not.toContain(email);
    }
    expect(журнал.join("\n")).toContain(меткаДляЖурнала(email));
  });
});

describe("Метка для журнала: свойства, без которых она опасна", () => {
  it("одна и та же для одного адреса, разная для разных", () => {
    expect(меткаДляЖурнала("a@test.aev")).toBe(меткаДляЖурнала("  A@Test.AEV  "));
    expect(меткаДляЖурнала("a@test.aev")).not.toBe(меткаДляЖурнала("b@test.aev"));
  });

  it("🔴 метка НЕ является токеном отписки — иначе журнал даёт отписать любого", () => {
    const email = "mark-vs-token@test.aev";
    const метка = меткаДляЖурнала(email);
    const токен = unsubToken(email)!;
    expect(токен).toBeTruthy();
    expect(метка).not.toBe(токен);
    // и не содержит его даже частично: приставки `log:` и `unsub:` разные
    expect(метка).not.toContain(токен);
    expect(токен).not.toContain(метка.replace(/^log:/, ""));
  });

  it("без секрета метка всё равно НЕ адрес и честно называет себя", () => {
    delete process.env.WAITLIST_UNSUB_SECRET;
    delete process.env.AUTH_JWT_SECRET;
    const email = "nokey@test.aev";
    const метка = меткаДляЖурнала(email);
    expect(метка).toContain("log-nokey:");
    expect(метка).not.toContain(email);
    expect(unsubToken(email), "без секрета токена быть не может").toBeNull();
  });
});
