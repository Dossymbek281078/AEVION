import { describe, test, expect, vi, beforeEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Сторож: ручка «состоялась ли выдача» различает ТРИ исхода.
 *
 * ЗАЧЕМ ОНА ВООБЩЕ. Страница успеха до 03.09.2026 показывала тариф прямо из
 * адресной строки: значение подделывается и ничего не знает о неудаче выдачи.
 * Человек, которому не выдали купленное, видел «всё готово».
 *
 * ГЛАВНОЕ, ЧТО ЗДЕСЬ ОХРАНЯЕТСЯ — третий исход. Сбой чтения, схлопнутый в
 * «ещё не готово», сказал бы заплатившему «ждите» навсегда, и страница
 * крутила бы ожидание вечно. Поэтому:
 *   выдано            → 200 ready:true + тариф
 *   ещё нет           → 200 ready:false
 *   прочитать не смог → 503, а НЕ ready:false
 */
const { режим } = vi.hoisted(() => ({ режим: { сломано: false } }));

vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => () => {} }));
vi.mock("node:fs", async (real) => {
  const fs = await real<typeof import("node:fs")>();
  const про = (p: unknown) => String(p).includes("subs-status");
  return {
    ...fs,
    default: fs,
    readFileSync: (p: string, ...a: unknown[]) => {
      if (про(p) && режим.сломано) throw new Error("диск недоступен");
      return (fs.readFileSync as (...x: unknown[]) => unknown)(p, ...a);
    },
  };
});

const каталог = mkdtempSync(join(tmpdir(), "aevion-status-"));
const файл = join(каталог, "subs-status.jsonl");
process.env.SUBSCRIPTIONS_FILE = файл;

writeFileSync(
  файл,
  JSON.stringify({
    id: "sub_gumroad_1",
    ts: new Date().toISOString(),
    email: "buyer@example.test",
    tierId: "medium",
    period: "annual",
    seats: 1,
    modules: [],
    trialDays: 0,
    providerPaymentId: "sale-777",
  }) + "\n" +
    JSON.stringify({
      id: "sub_paybox_pay-999",
      ts: new Date().toISOString(),
      email: "old@example.test",
      tierId: "lite",
      period: "monthly",
      seats: 1,
      modules: [],
      trialDays: 0,
    }) + "\n",
  "utf8"
);

const { checkoutRouter } = await import("../src/routes/checkout");

function приложение() {
  const a = express();
  a.use(express.json());
  a.use("/api/pricing/checkout", checkoutRouter);
  return a;
}

beforeEach(() => {
  режим.сломано = false;
});

afterAll(() => rmSync(каталог, { recursive: true, force: true }));

describe("статус выдачи различает три исхода", () => {
  test("выдано — ready:true и настоящий тариф", async () => {
    const r = await request(приложение()).get("/api/pricing/checkout/status?intentId=sale-777");
    expect(r.status).toBe(200);
    expect(r.body.ready, "выдача есть, а ручка говорит «нет»").toBe(true);
    expect(r.body.tier, "тариф не тот, что записан").toBe("medium");
    expect(r.body.period, "период потерялся").toBe("annual");
  });

  test("старая запись без поля — находится по номеру подписки", async () => {
    // У paybox и paypal идентификатор зашит в номер: sub_paybox_<id>.
    // Иначе давние покупки отвечали бы «не выдано» при живой подписке.
    const r = await request(приложение()).get("/api/pricing/checkout/status?intentId=pay-999");
    expect(r.body.ready, "старая запись не найдена по номеру подписки").toBe(true);
    expect(r.body.tier).toBe("lite");
  });

  test("ещё не выдано — ready:false, но код 200", async () => {
    const r = await request(приложение()).get("/api/pricing/checkout/status?intentId=нет-такого");
    expect(r.status).toBe(200);
    expect(r.body.ready).toBe(false);
  });

  test("ПРОЧИТАТЬ НЕ УДАЛОСЬ — 503, а не «ещё не готово»", async () => {
    режим.сломано = true;
    const r = await request(приложение()).get("/api/pricing/checkout/status?intentId=sale-777");
    expect(
      r.status,
      "сбой чтения выдан за «ещё не готово»: заплативший будет ждать вечно"
    ).toBe(503);
    expect(r.body.ready, "при сбое чтения нельзя утверждать готовность").not.toBe(false);
  });

  test("без идентификатора — 400, а не выдумка", async () => {
    const r = await request(приложение()).get("/api/pricing/checkout/status");
    expect(r.status).toBe(400);
  });
});
