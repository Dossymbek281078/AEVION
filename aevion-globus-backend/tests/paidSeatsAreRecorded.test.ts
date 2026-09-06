import { describe, test, expect, vi, beforeEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Сторож: за сколько мест заплатили — столько и записано.
 *
 * ЗАМЕР 04.09.2026. Витрина считает цену по числу мест (buildQuote в
 * checkout.ts), а вебхуки звали выдачу БЕЗ `seats`, и умолчание
 * provisioning.ts `seats: input.seats ?? 1` ставило единицу. Человек платил
 * за пять мест ($37 против $19 у lite), а его же страница подписки
 * показывала одно (routes/pricing.ts:1512).
 *
 * ⚠ ГРАНИЦА, КОТОРУЮ ВАЖНО НЕ ПОТЕРЯТЬ. Сторож про paybox и paypal — это
 * ЕДИНСТВЕННЫЕ две кассы, которые получают нашу сумму и списывают её
 * (payboxProvider.ts:113, paypalProvider.ts:108). У Lemon Squeezy и Gumroad
 * сумма до кассы не доезжает: там списывают цену товара, то есть за ОДНО
 * место, и запись «1» там ПРАВИЛЬНАЯ. Не копируйте эту проверку на них,
 * пока не решён пункт 8 записки основателя — иначе мы начнём записывать
 * места, за которые денег не брали.
 *
 * Число мест приходит СНАРУЖИ (через данные кассы), поэтому проверяется и
 * враждебный вход: дробь, минус, буквы — всё это одно место.
 */
const каталог = mkdtempSync(join(tmpdir(), "aevion-seats-"));
const файл = join(каталог, "s.jsonl");
process.env.SUBSCRIPTIONS_FILE = файл;

let полезная: Record<string, string> = {};
let полезнаяPaypal: Record<string, unknown> = {};

vi.mock("../src/lib/payment/payboxProvider", () => ({
  payboxPaymentProvider: {
    parseWebhook: () => ({
      result: { status: "paid", reason: null, raw: полезная },
      eventId: полезная.pg_payment_id,
    }),
  },
}));
vi.mock("../src/lib/payment/paypalProvider", () => ({
  verifyPaypalWebhook: async () => true,
  paypalPaymentProvider: {
    parseWebhook: () => ({
      result: { status: "paid", reason: null, raw: полезнаяPaypal },
      eventId: String(полезнаяPaypal.id ?? ""),
    }),
  },
}));
vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => () => {} }));

const { payboxWebhookRouter } = await import("../src/routes/payboxWebhook");
const { paypalWebhookRouter } = await import("../src/routes/paypalWebhook");

let n = 0;

function приложение(путь: string, роутер: express.Router) {
  const a = express();
  a.use(express.json());
  a.use((req, _r, next) => {
    (req as unknown as { rawBody: Buffer }).rawBody = Buffer.from("x");
    next();
  });
  a.use(путь, роутер);
  return a;
}

async function черезPaybox(seats?: string) {
  n += 1;
  полезная = {
    pg_user_contact_email: `pb-${n}@example.test`,
    pg_order_id: "tier_medium_monthly",
    pg_payment_id: `seats-pb-${n}`,
    ...(seats === undefined ? {} : { pg_param_seats: seats }),
  };
  return request(приложение("/api/paybox", payboxWebhookRouter)).post("/api/paybox/webhook").send();
}

async function черезPaypal(seats?: unknown) {
  n += 1;
  полезнаяPaypal = {
    id: `seats-pp-${n}`,
    custom_id: JSON.stringify({
      reference: "tier_medium_monthly",
      ...(seats === undefined ? {} : { seats }),
    }),
    payer: { email_address: `pp-${n}@example.test` },
  };
  return request(приложение("/api/paypal", paypalWebhookRouter)).post("/api/paypal/webhook").send();
}

/** Места в последней записанной подписке. */
function записаноМест(): number | undefined {
  if (!existsSync(файл)) return undefined;
  const строки = readFileSync(файл, "utf8").split("\n").filter((l) => l.trim());
  if (!строки.length) return undefined;
  return JSON.parse(строки[строки.length - 1]).seats;
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterAll(() => {
  try { rmSync(каталог, { recursive: true, force: true }); } catch { /* уже нет */ }
  delete process.env.SUBSCRIPTIONS_FILE;
});

describe("оплаченные места записываются", () => {
  test("КОНТРОЛЬ: без мест в данных кассы записывается одно", async () => {
    // Без этого «записано 5» удовлетворялось бы кодом, который ставит пять
    // всем подряд, — то есть мы раздавали бы места, за которые не платили.
    await черезPaybox(undefined);
    expect(записаноМест(), "обычная покупка получила не одно место").toBe(1);
  });

  test("paybox: заплатил за 5 мест — записано 5", async () => {
    await черезPaybox("5");
    expect(
      записаноМест(),
      "сумма списана за пять мест, а в подписке одно: своя же страница покажет покупателю меньше купленного"
    ).toBe(5);
  });

  // ФОРМА ЗНАЧЕНИЯ КАК В ПРОДЕ. checkout.ts кладёт в customData СТРОКУ
  // (`String(seats)`), поэтому в custom_id приезжает "7", а не 7. Первая
  // версия теста слала число — он был бы зелёным и на коде, который умеет
  // только числа, то есть проверял бы не тот вход. Проверяем обе формы:
  // строку — потому что так делает прод, число — потому что JSON это
  // позволяет и завтра форма может измениться.
  test.each([
    ["строка, как шлёт витрина", "7"],
    ["число", 7],
  ])("paypal: заплатил за 7 мест (%s) — записано 7", async (_имя, значение) => {
    // Сестринская касса. Охранять одну и оставить вторую — ровно та
    // асимметрия, из-за которой этот класс и живёт.
    await черезPaypal(значение);
    expect(записаноМест(), "paypal не довозит места до записи").toBe(7);
  });

  test.each([
    ["дробь", "3.9"],
    ["минус", "-2"],
    ["буквы", "abc"],
    ["ноль", "0"],
  ])("враждебное значение (%s) даёт одно место", async (_имя, значение) => {
    await черезPaybox(значение);
    expect(
      записаноМест(),
      `значение ${значение} прошло в запись подписки как есть`
    ).toBe(1);
  });
});
