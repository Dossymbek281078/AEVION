import { describe, test, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Сторож: модуль, купленный через ЛЮБУЮ кассу, получает долговечную запись.
 *
 * ЗАЧЕМ. Права на модуль хранятся в двух местах: тариф — в файле
 * data/subscriptions.jsonl, помодульная покупка — в таблице AppSubscription,
 * и именно её читает запасной путь стены (planGate -> hasActiveAppSubscription).
 * Lemon Squeezy и Gumroad писали обе записи, PayBox и PayPal — только файл.
 * То есть надёжность доступа зависела от того, какой кассой заплатил человек,
 * а не от того, что он купил. Файл при этом ЕДИНСТВЕННЫЙ: Postgres мы копируем,
 * файл — нет.
 *
 * Проверяются три РАЗНЫХ утверждения, поэтому и мутаций к ним три:
 *   1) помодульная покупка запись создаёт;
 *   2) покупка одного тарифа — НЕ создаёт (иначе тариф размазался бы по
 *      таблице «одна строка на модуль» и права выдавались бы не те);
 *   3) отказ базы не ломает выдачу, но оставляет след с ЧТО и КОМУ.
 */

const upserts: Array<[string, string, string, string | undefined]> = [];
let пуститьОшибку = false;

vi.mock("../src/lib/appEntitlements", () => ({
  upsertAppSubscription: async (
    email: string,
    appSlug: string,
    status: string,
    externalSubId?: string,
  ) => {
    if (пуститьОшибку) throw new Error("база недоступна");
    upserts.push([email, appSlug, status, externalSubId]);
  },
}));

vi.mock("../src/routes/provisioning", () => ({
  provisionSubscription: async () => ({ subscription: { id: "sub-777" } }),
  writeSubscription: () => {},
}));

const captured: Array<Record<string, unknown>> = [];
vi.mock("../src/lib/sentry/platform", () => ({
  makeServiceCapture: () => (_err: unknown, ctx: Record<string, unknown> = {}) => {
    captured.push(ctx);
  },
}));

let полезная: Record<string, string> = {};
let статус = "paid";
vi.mock("../src/lib/payment/payboxProvider", () => ({
  payboxPaymentProvider: {
    parseWebhook: () => ({
      result: { status: статус, reason: null, raw: полезная },
      eventId: полезная.pg_payment_id,
    }),
  },
}));

let полезнаяPaypal: Record<string, unknown> = {};
let статусPaypal = "paid";
vi.mock("../src/lib/payment/paypalProvider", () => ({
  verifyPaypalWebhook: async () => true,
  paypalPaymentProvider: {
    parseWebhook: () => ({
      result: { status: статусPaypal, reason: null, raw: полезнаяPaypal },
      eventId: String(полезнаяPaypal.id ?? ""),
    }),
  },
}));

const { payboxWebhookRouter } = await import("../src/routes/payboxWebhook");
const { paypalWebhookRouter } = await import("../src/routes/paypalWebhook");

function приложение() {
  const a = express();
  a.use((req, _res, next) => {
    (req as unknown as { rawBody: Buffer }).rawBody = Buffer.from("x");
    next();
  });
  a.use("/api/paybox", payboxWebhookRouter);
  return a;
}

let счётчик = 0;
function оплата(модуль?: string, вид = "paid") {
  статус = вид;
  счётчик += 1;
  полезная = {
    pg_user_contact_email: "buyer@example.com",
    pg_order_id: "aevion-lite-monthly",
    // каждый вызов свой, иначе сработает защита от повторной доставки
    pg_payment_id: `pay-${счётчик}`,
    ...(модуль ? { pg_param_module: модуль } : {}),
  };
  return request(приложение()).post("/api/paybox/webhook").send();
}

beforeEach(() => {
  upserts.length = 0;
  captured.length = 0;
  пуститьОшибку = false;
  статус = "paid";
  статусPaypal = "paid";
});

describe("купленный модуль переживает потерю файла", () => {
  test("помодульная покупка создаёт долговечную запись", async () => {
    const res = await оплата("qcoreai");

    // Контроль прибора: обработчик действительно дошёл до выдачи, иначе
    // «записи нет» означало бы, что мы меряем не тот путь.
    expect(res.body.action, "покупка не была проведена — тест мерит не то").toBe("activated");

    expect(upserts.length, "модуль куплен, а долговечной записи нет").toBe(1);
    expect(upserts[0][0]).toBe("buyer@example.com");
    expect(upserts[0][1], "записан не тот модуль").toBe("qcoreai");
    expect(upserts[0][2]).toBe("active");
    expect(upserts[0][3], "запись не привязана к подписке").toBe("sub-777");
  });

  test("покупка одного тарифа помодульной записи НЕ создаёт", async () => {
    const res = await оплата();
    expect(res.body.action).toBe("activated");
    expect(upserts.length, "тариф записан как покупка модуля — права выданы не те").toBe(0);
  });

  test("отказ базы не ломает выдачу, но оставляет след", async () => {
    пуститьОшибку = true;
    const предупреждения: string[] = [];
    const шпион = vi
      .spyOn(console, "warn")
      .mockImplementation((...a: unknown[]) => void предупреждения.push(a.map(String).join(" ")));

    const res = await оплата("qcoreai");
    шпион.mockRestore();

    // Доступ уже выдан файлом — ронять обработчик нельзя: касса повторит
    // доставку и выдаст покупку второй раз.
    expect(res.status, "отказ базы уронил обработчик").toBe(200);
    expect(res.body.action).toBe("activated");

    const след = предупреждения.join(" | ");
    expect(след, "отказ прошёл молча").toContain("buyer@example.com");
    expect(след, "в следе не назван модуль").toContain("qcoreai");
    expect(captured.length, "отказ не доехал до Sentry").toBeGreaterThan(0);
  });
});

describe("вторая касса закрыта тем же правилом", () => {
  // Без этого блока сторож молчал бы при пропаже записи у PayPal: правило
  // «хотя бы одна касса пишет» переживает потерю всех, кроме одной.
  test("PayPal тоже создаёт долговечную запись", async () => {
    счётчик += 1;
    полезнаяPaypal = {
      id: `pp-${счётчик}`,
      payer: { email_address: "Buyer@Example.com" },
      custom_id: JSON.stringify({ reference: "aevion-lite-monthly", module: "qlearn" }),
    };

    const a = express();
    a.use((req, _res, next) => {
      (req as unknown as { rawBody: Buffer }).rawBody = Buffer.from("x");
      next();
    });
    a.use("/api/paypal", paypalWebhookRouter);

    const res = await request(a).post("/api/paypal/webhook").send();

    expect(res.body.action, "покупка не была проведена — тест мерит не то").toBe("activated");
    expect(upserts.length, "модуль куплен через PayPal, а долговечной записи нет").toBe(1);
    expect(upserts[0][1], "записан не тот модуль").toBe("qlearn");
    expect(upserts[0][0], "адрес не приведён к нижнему регистру").toBe("buyer@example.com");
  });
});

describe("возврат денег снимает доступ к модулю", () => {
  // Пара обязана быть замкнутой: если покупка создаёт строку в базе, то
  // возврат обязан её снимать. Иначе тариф понижается в файле, строка
  // остаётся активной, и запасной путь стены пускает человека, которому
  // деньги вернули. Lemon Squeezy это делает давно — здесь было упущено.
  test("возврат ставит записи cancelled", async () => {
    const res = await оплата("qcoreai", "refunded");

    expect(res.body.action, "возврат не был обработан — тест мерит не то").toBe("downgraded");
    expect(upserts.length, "возврат не тронул долговечную запись").toBe(1);
    expect(upserts[0][1]).toBe("qcoreai");
    expect(upserts[0][2], "запись осталась активной после возврата").toBe("cancelled");
  });

  test("сбой базы при возврате НЕ выдаётся за успех", async () => {
    // Направление отказа обратное покупке: здесь молчание означает, что
    // человек пользуется тем, за что ему вернули деньги.
    пуститьОшибку = true;
    const шпион = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await оплата("qcoreai", "refunded");
    шпион.mockRestore();

    expect(res.status, "сбой снятия доступа отдан кассе как успех").toBe(500);
    expect(res.body.action, "ответ утверждает, что доступ снят").toBeUndefined();
    expect(captured.length, "сбой не доехал до Sentry").toBeGreaterThan(0);
  });
});

describe("возврат у второй кассы закрыт тем же правилом", () => {
  test("возврат через PayPal тоже ставит cancelled", async () => {
    статусPaypal = "refunded";
    счётчик += 1;
    полезнаяPaypal = {
      id: `pp-r-${счётчик}`,
      payer: { email_address: "buyer@example.com" },
      custom_id: JSON.stringify({ reference: "aevion-lite-monthly", module: "qlearn" }),
    };

    const a = express();
    a.use((req, _res, next) => {
      (req as unknown as { rawBody: Buffer }).rawBody = Buffer.from("x");
      next();
    });
    a.use("/api/paypal", paypalWebhookRouter);

    const res = await request(a).post("/api/paypal/webhook").send();

    expect(res.body.action, "возврат не был обработан — тест мерит не то").toBe("downgraded");
    expect(upserts.length, "возврат через PayPal не тронул долговечную запись").toBe(1);
    expect(upserts[0][2], "запись осталась активной после возврата").toBe("cancelled");
  });
});
