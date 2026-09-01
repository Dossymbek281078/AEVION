import { describe, test, expect, vi, beforeEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { mkdtempSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Сквозная проверка денежного пути: ОПЛАТИЛ → ПОЛУЧИЛ ДОСТУП.
 *
 * ЗАЧЕМ. В наборе 33 теста про вебхуки оплаты, и ни один не спрашивает
 * главного: получает ли человек то, за что заплатил. Каждый шаг проверен
 * по отдельности — разбор ссылки заказа, запись подписки, чтение тарифа,
 * решение стены — и каждый зелёный. Но именно так выглядит класс поломок,
 * который у нас уже был на регистрации: сервер отвечает «ok», сторожа
 * зелёные, а человек не может пройти путь.
 *
 * Здесь НЕТ подмены выдачи и НЕТ подмены прав: вебхук пишет настоящий файл
 * подписок (во временный каталог), а тариф читает та же функция, которой
 * пользуется стена на проде. Подменён только разбор уведомления кассы —
 * это внешняя сторона, её в тесте быть не может.
 */

// Файл подписок ДО импорта модулей: путь читается на уровне модуля.
const каталог = mkdtempSync(join(tmpdir(), "aevion-e2e-"));
const файлПодписок = join(каталог, "subscriptions.jsonl");
process.env.SUBSCRIPTIONS_FILE = файлПодписок;

// Стена включается переменной и читается при КАЖДОМ вызове (кэша нет),
// поэтому её можно поднять прямо здесь и проверить настоящие ворота, а не
// только предикат «покрывает ли тариф модуль».
process.env.PAYWALL_MODULES = "multichat-engine";
process.env.AUTH_JWT_SECRET = "тестовый-секрет-достаточной-длины-для-проверки-32+";

let полезная: Record<string, string> = {};
let полезнаяСтатус = "paid";
vi.mock("../src/lib/payment/payboxProvider", () => ({
  payboxPaymentProvider: {
    parseWebhook: () => ({
      result: { status: полезнаяСтатус, reason: null, raw: полезная },
      eventId: полезная.pg_payment_id,
    }),
  },
}));

vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => () => {} }));

const { payboxWebhookRouter } = await import("../src/routes/payboxWebhook");
const { resolvePlanFromPayload, isModuleEntitled, tiersForModule, requireModule, paywallEnabledFor } =
  await import("../src/lib/planGate");
const jwt = (await import("jsonwebtoken")).default;

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
async function вернул(email: string, тариф: string) {
  счётчик += 1;
  полезнаяСтатус = "refunded";
  полезная = {
    pg_user_contact_email: email,
    pg_order_id: `tier_${тариф}_monthly`,
    pg_payment_id: `pay-e2e-${счётчик}`,
  };
  const r = await request(приложение()).post("/api/paybox/webhook").send();
  полезнаяСтатус = "paid";
  return r;
}

async function оплатил(email: string, тариф: string) {
  счётчик += 1;
  полезная = {
    pg_user_contact_email: email,
    pg_order_id: `tier_${тариф}_monthly`,
    pg_payment_id: `pay-e2e-${счётчик}`,
  };
  return request(приложение()).post("/api/paybox/webhook").send();
}

function закрытоеПриложение() {
  const a = express();
  a.use("/api/multichat-engine", requireModule("multichat-engine"));
  a.get("/api/multichat-engine/ping", (_req, res) => res.json({ ok: true }));
  return a;
}

function токен(email: string) {
  return jwt.sign({ email, sub: email }, process.env.AUTH_JWT_SECRET as string, {
    algorithm: "HS256",
    expiresIn: "1h",
  });
}

afterAll(() => {
  delete process.env.SUBSCRIPTIONS_FILE;
  delete process.env.PAYWALL_MODULES;
  delete process.env.AUTH_JWT_SECRET;
});

describe("оплатил — получил доступ", () => {
  beforeEach(() => vi.spyOn(console, "warn").mockImplementation(() => {}));

  test("контроль: ДО оплаты доступа нет", () => {
    const план = resolvePlanFromPayload({ email: "новый@example.com" });
    expect(план.tier, "человек без покупки уже с тарифом — тест мерит не то").toBe("free");
    expect(isModuleEntitled(план, "multichat-engine")).toBe(false);
  });

  test("после оплаты medium доступ к закрытому модулю ЕСТЬ", async () => {
    const email = "buyer-e2e@example.com";
    const res = await оплатил(email, "medium");

    // Контроль прибора: платёж действительно проведён, а файл действительно
    // написан — иначе «доступа нет» означало бы, что мы меряем не тот путь.
    expect(res.body.action, "оплата не была проведена").toBe("activated");
    expect(existsSync(файлПодписок), "файл подписок не создан").toBe(true);
    expect(readFileSync(файлПодписок, "utf8"), "запись не попала в файл").toContain(email);

    const план = resolvePlanFromPayload({ email });
    expect(план.tier, "оплатил medium, а тариф другой").toBe("medium");

    // Модуль запуска 10.09: стена требует medium и выше.
    expect(tiersForModule("multichat-engine")).toContain("medium");
    expect(
      isModuleEntitled(план, "multichat-engine"),
      "человек заплатил, а доступа к купленному нет",
    ).toBe(true);
  });

  test("оплата младшего тарифа доступа к старшему модулю НЕ даёт", async () => {
    const email = "lite-e2e@example.com";
    await оплатил(email, "lite");
    const план = resolvePlanFromPayload({ email });
    expect(план.tier).toBe("lite");
    expect(
      isModuleEntitled(план, "multichat-engine"),
      "дешёвый тариф открыл модуль, который требует medium",
    ).toBe(false);
  });
});

describe("настоящие ворота: стена ВКЛЮЧЕНА", () => {
  // Предыдущий блок проверяет предикат «покрывает ли тариф модуль». Ворота —
  // отдельная вещь: сломай middleware, и предикат останется зелёным, а
  // покупатель упрётся в отказ. На день запуска значение имеет именно это.
  test("контроль: стена действительно включена для этого модуля", () => {
    // Без этого «анонимного пустили» означало бы, что стена просто выключена,
    // а не что она сломана.
    expect(paywallEnabledFor("multichat-engine")).toBe(true);
  });

  test("анонимный получает отказ, а не доступ", async () => {
    const res = await request(закрытоеПриложение()).get("/api/multichat-engine/ping");
    expect(res.status, "стена пустила человека без покупки").not.toBe(200);
  });

  test("оплативший medium ПРОХОДИТ ворота", async () => {
    const email = "gate-e2e@example.com";
    const оплата = await оплатил(email, "medium");
    expect(оплата.body.action, "оплата не проведена — тест мерит не то").toBe("activated");

    const res = await request(закрытоеПриложение())
      .get("/api/multichat-engine/ping")
      .set("Authorization", `Bearer ${токен(email)}`);

    expect(res.status, "человек заплатил, а ворота его не пускают").toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test("оплативший lite в эти ворота НЕ проходит", async () => {
    const email = "gate-lite-e2e@example.com";
    await оплатил(email, "lite");
    const res = await request(закрытоеПриложение())
      .get("/api/multichat-engine/ping")
      .set("Authorization", `Bearer ${токен(email)}`);
    expect(res.status, "дешёвый тариф открыл ворота старшего модуля").not.toBe(200);
  });
});

describe("возврат денег снимает доступ", () => {
  // Пара обязана быть замкнутой там, где её видит покупатель: выдали доступ —
  // обязаны снять. Записи я закрыл отдельно, но между записью и воротами
  // стоит ещё цепочка, и проверял её до сих пор никто.
  test("оплатил — прошёл, вернули деньги — не проходит", async () => {
    const email = "refund-e2e@example.com";

    await оплатил(email, "medium");
    const доступДо = await request(закрытоеПриложение())
      .get("/api/multichat-engine/ping")
      .set("Authorization", `Bearer ${токен(email)}`);
    // Контроль: без этого «не пускают после возврата» означало бы, что не
    // пускали и до него.
    expect(доступДо.status, "человек заплатил, а доступа не было изначально").toBe(200);

    const возврат = await вернул(email, "medium");
    expect(возврат.body.action, "возврат не был обработан — тест мерит не то").toBe("downgraded");

    const доступПосле = await request(закрытоеПриложение())
      .get("/api/multichat-engine/ping")
      .set("Authorization", `Bearer ${токен(email)}`);
    expect(
      доступПосле.status,
      "деньги вернули, а доступ остался",
    ).not.toBe(200);
  });
});
