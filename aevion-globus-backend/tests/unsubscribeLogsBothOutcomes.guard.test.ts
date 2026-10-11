import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import { unsubToken } from "../src/lib/waitlistUnsubToken";

/**
 * Отписка обязана оставлять след ОБА раза и не отрицать только что исполненную
 * просьбу.
 *
 * 🔴 Поводы (11.10.2026, нашёл оркестратор):
 *  1. След оставался только при СБОЕ (`capture` в ветке ошибки). Удачная
 *     отписка не писала ничего — доказать, что просьбу человека исполнили,
 *     было нечем, а это требование закона, не удобство.
 *  2. Браузеры и клиенты дёргают GET-ссылку дважды. Первый заход удалял строку,
 *     второй видел `rowCount = 0` и говорил «его там уже не было» — отрицал
 *     отписку, которая только что произошла.
 *
 * Сторож делает ЗАПРОСЫ К РУЧКЕ (supertest) и читает ТЕЛО ответа и журнал, а не
 * предикаты. Журнал читается подменой `console.log`/`console.warn` — это и есть
 * тот самый след, о котором речь.
 */

const { query, sendConfirm } = vi.hoisted(() => ({
  query: vi.fn(),
  sendConfirm: vi.fn(async () => true),
}));
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query }) }));
vi.mock("../src/lib/constitutionBrevo", () => ({
  sendWaitlistConfirm: (...a: unknown[]) => sendConfirm(...(a as [])),
  sendWeeklyDigestEmail: vi.fn(async () => ({ sent: 0 })),
}));

let ipSeq = 0;
async function приложение() {
  const { constitutionWaitlistRouter } = await import("../src/routes/constitutionWaitlist");
  const a = express();
  a.set("trust proxy", true);
  a.use((req, _res, next) => {
    ipSeq += 1;
    req.headers["x-forwarded-for"] = `10.7.${Math.floor(ipSeq / 250) % 250}.${(ipSeq % 250) + 1}`;
    next();
  });
  a.use(express.json());
  a.use("/api/constitution/waitlist", constitutionWaitlistRouter);
  return a;
}

let журнал: string[] = [];
let родной: { log: typeof console.log; warn: typeof console.warn };

beforeEach(() => {
  process.env.AUTH_JWT_SECRET = "test-secret-at-least-32-chars-long-unsub";
  журнал = [];
  родной = { log: console.log, warn: console.warn };
  console.log = (...a: unknown[]) => void журнал.push("log " + a.map(String).join(" "));
  console.warn = (...a: unknown[]) => void журнал.push("warn " + a.map(String).join(" "));
  query.mockReset();
  sendConfirm.mockReset();
  sendConfirm.mockResolvedValue(true);
});
afterEach(() => {
  console.log = родной.log;
  console.warn = родной.warn;
});

/** Ответы пула как у Postgres: CREATE TABLE молча, DELETE — со своим rowCount. */
function базаОтвечает(удалено: number) {
  query.mockImplementation(async (sql: string) => {
    if (/^\s*CREATE TABLE/i.test(sql)) return { rows: [], rowCount: 0 };
    if (/^\s*DELETE/i.test(sql)) return { rows: [], rowCount: удалено };
    if (/^\s*INSERT/i.test(sql)) return { rows: [{ inserted: true }], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  });
}

const отписаться = async (email: string) =>
  request(await приложение())
    .get("/api/constitution/waitlist/unsubscribe")
    .query({ email, t: unsubToken(email)! });

describe("Отписка: след в журнале на оба исхода", () => {
  it("прибор видит предмет: ручка отвечает 200 и журнал читается", async () => {
    базаОтвечает(1);
    const r = await отписаться("unsub-probe-1@test.aev");
    expect(r.status).toBe(200);
    expect(журнал.length, "журнал пуст — подмена console не сработала").toBeGreaterThan(0);
  });

  it("🔴 удачная отписка пишет АДРЕС и ЧИСЛО СТРОК", async () => {
    базаОтвечает(1);
    await отписаться("unsub-probe-2@test.aev");
    const строка = журнал.find((s) => s.includes("ОТПИСКА ВЫПОЛНЕНА"));
    expect(строка, "нет следа удачной отписки").toBeTruthy();
    expect(строка).toContain("unsub-probe-2@test.aev");
    expect(строка).toContain("rowCount=1");
  });

  it("🔴 адреса не было — тоже след, и с нулём строк", async () => {
    базаОтвечает(0);
    await отписаться("unsub-probe-3@test.aev");
    const строка = журнал.find((s) => s.includes("адреса в списке не было"));
    expect(строка, "нет следа исхода «не было»").toBeTruthy();
    expect(строка).toContain("rowCount=0");
  });
});

describe("Отписка на СВЕЖЕМ процессе (первый запрос — именно она)", () => {
  /*
   * 🔴 Этот случай и вскрыл настоящую причину. `dbAvailable` выставляет только
   * `ensureWaitlistTable()`, а звали её подписка и админские ручки. Пока в
   * процессе не случилось подписки, отписка видела `dbAvailable === false`,
   * DELETE не отправляла вовсе и отвечала 200 «удалён (его там уже не было)» —
   * строка в Postgres при этом оставалась, письма шли дальше.
   *
   * Проверяется НЕ флаг, а факт: ушёл ли в пул запрос DELETE.
   */
  it("🔴 DELETE уходит в базу даже если подписки в этом процессе не было", async () => {
    vi.resetModules(); // свежий модуль = tableReady false, как после перезапуска
    базаОтвечает(1);
    const email = "fresh-process@test.aev";
    const r = await отписаться(email);
    expect(r.status).toBe(200);

    const sqls = query.mock.calls.map((c) => String(c[0]));
    expect(sqls.some((q) => /^\s*CREATE TABLE/i.test(q)), "таблицу не проверяли").toBe(true);
    expect(
      sqls.some((q) => /^\s*DELETE FROM constitution_waitlist/i.test(q)),
      "DELETE не ушёл в базу — отписка только на словах",
    ).toBe(true);
    expect(r.text).not.toContain("его там уже не было");
  });

  it("КОНТРОЛЬ ПРИБОРА: он отличает «ушёл DELETE» от «не ушёл»", async () => {
    vi.resetModules();
    базаОтвечает(1);
    const sqls0 = query.mock.calls.length;
    expect(sqls0).toBe(0); // счётчик чист — значит дальше считаем именно наши запросы
    await отписаться("control-probe@test.aev");
    expect(query.mock.calls.length).toBeGreaterThan(sqls0);
  });
});

describe("Отписка: повторный заход по той же ссылке", () => {
  it("🔴 второй GET НЕ говорит «его там уже не было»", async () => {
    const email = "unsub-probe-4@test.aev";
    базаОтвечает(1);
    const первый = await отписаться(email);
    expect(первый.text).not.toContain("его там уже не было");

    базаОтвечает(0); // строки уже нет — ровно то, что увидит второй запрос
    журнал = [];
    const второй = await отписаться(email);
    expect(второй.status).toBe(200);
    expect(второй.text, "второй заход отрицает только что исполненную отписку").not.toContain(
      "его там уже не было",
    );
    expect(журнал.find((s) => s.includes("ПОВТОРНЫЙ ЗАХОД"))).toBeTruthy();
  });

  it("ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ: адресу, которого не отписывали, текст ОСТАЁТСЯ", async () => {
    базаОтвечает(0);
    const r = await отписаться("nikogda-ne-byl@test.aev");
    expect(r.status).toBe(200);
    expect(r.text, "формулировка пропала там, где она ВЕРНА").toContain("его там уже не было");
  });
});

describe("Повторная подписка после отписки", () => {
  const подписаться = async (email: string) =>
    request(await приложение())
      .post("/api/constitution/waitlist/subscribe")
      .send({ email, source: "cyberchess" });

  it("🔴 после отписки подписка снова шлёт письмо подтверждения", async () => {
    const email = "resub-probe@test.aev";
    базаОтвечает(1);
    const a = await подписаться(email);
    expect([200, 201]).toContain(a.status);
    expect(sendConfirm).toHaveBeenCalledTimes(1);

    await отписаться(email);

    sendConfirm.mockClear();
    базаОтвечает(1);
    const b = await подписаться(email);
    expect([200, 201]).toContain(b.status);
    expect(sendConfirm, "после отписки человек снова подписался и остался без письма").toHaveBeenCalledTimes(1);
  });

  it("ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ: повторная подписка БЕЗ отписки письма не шлёт", async () => {
    const email = "dubl-probe@test.aev";
    query.mockImplementation(async (sql: string) => {
      if (/^\s*CREATE TABLE/i.test(sql)) return { rows: [], rowCount: 0 };
      // База сообщает КОНФЛИКТ: строка была, это не вставка.
      if (/^\s*INSERT/i.test(sql)) return { rows: [{ inserted: false }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    await подписаться(email);
    expect(sendConfirm, "письмо ушло на повторную подписку").not.toHaveBeenCalled();
  });
});
