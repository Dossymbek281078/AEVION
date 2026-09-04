import { describe, test, expect, vi, beforeEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Сторож: возврат отзывает ТУ подписку, за которую вернули деньги.
 *
 * Ворота платного доступа спрашивают `readLatestSubscription` — она берёт
 * ПОСЛЕДНЮЮ ЗАПИСАННУЮ строку по адресу, а ветка возврата писала понижение
 * до `free` безусловно. Сценарий, бьющий по заплатившему:
 *
 *   купил Lite -> обновился до Medium (новая платная запись)
 *   -> пришёл возврат за ПЕРВЫЙ платёж -> понижение легло последним
 *   -> человек потерял Medium, за который заплатил и который не возвращали.
 *
 * Проверка ОБЯЗАТЕЛЬНО двусторонняя: без первого теста починка легко
 * превращается в «возвраты больше ничего не отзывают», а это отдаёт
 * возвращённое даром и не видно никому.
 */
const каталог = mkdtempSync(join(tmpdir(), "aevion-refund-"));
const файл = join(каталог, "s.jsonl");
process.env.SUBSCRIPTIONS_FILE = файл;

let полезная: Record<string, string> = {};
let полезнаяPaypal: Record<string, unknown> = {};

vi.mock("../src/lib/payment/payboxProvider", () => ({
  payboxPaymentProvider: {
    parseWebhook: () => ({
      result: { status: "refunded", reason: null, raw: полезная },
      eventId: полезная.pg_payment_id,
    }),
  },
}));
vi.mock("../src/lib/payment/paypalProvider", () => ({
  verifyPaypalWebhook: async () => true,
  paypalPaymentProvider: {
    parseWebhook: () => ({
      result: { status: "refunded", reason: null, raw: полезнаяPaypal },
      eventId: String(полезнаяPaypal.id ?? ""),
    }),
  },
}));
vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => () => {} }));
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: async () => ({ rowCount: 1, rows: [] }) }),
}));

const { payboxWebhookRouter } = await import("../src/routes/payboxWebhook");
const { paypalWebhookRouter } = await import("../src/routes/paypalWebhook");

function положитьПлатную(email: string, paymentId: string, tierId = "medium") {
  writeFileSync(
    файл,
    JSON.stringify({
      id: `sub_paybox_${paymentId}`,
      ts: new Date().toISOString(),
      email,
      tierId,
      period: "monthly",
      seats: 1,
      modules: [],
      trialDays: 0,
      providerPaymentId: paymentId,
    }) + "\n",
    "utf8"
  );
}

function последнийТариф(): string | undefined {
  if (!existsSync(файл)) return undefined;
  const строки = readFileSync(файл, "utf8").split("\n").filter((l) => l.trim());
  if (!строки.length) return undefined;
  return JSON.parse(строки[строки.length - 1]).tierId;
}

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

async function возвратPaybox(email: string, paymentId: string) {
  полезная = {
    pg_user_contact_email: email,
    pg_order_id: "tier_medium_monthly",
    pg_payment_id: paymentId,
  };
  return request(приложение("/api/paybox", payboxWebhookRouter)).post("/api/paybox/webhook").send();
}

async function возвратPaypal(email: string, paymentId: string) {
  полезнаяPaypal = {
    id: paymentId,
    custom_id: JSON.stringify({ reference: "tier_medium_monthly" }),
    payer: { email_address: email },
  };
  return request(приложение("/api/paypal", paypalWebhookRouter)).post("/api/paypal/webhook").send();
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterAll(() => {
  try { rmSync(каталог, { recursive: true, force: true }); } catch { /* уже нет */ }
  delete process.env.SUBSCRIPTIONS_FILE;
});

describe("возврат отзывает только оплаченное этим платежом", () => {
  test("КОНТРОЛЬ: возврат за ТЕКУЩУЮ покупку по-прежнему отзывает доступ", async () => {
    // Без этого починка превращается в «возвраты ничего не отзывают»:
    // возвращённое остаётся доступным даром, и заметить это некому.
    const email = "current@example.test";
    положитьПлатную(email, "pay-current-12345678");
    await возвратPaybox(email, "pay-current-12345678");
    expect(
      последнийТариф(),
      "возврат за действующую покупку не отозвал доступ — платное осталось даром"
    ).toBe("free");
  });

  test("возврат за СТАРУЮ покупку не трогает действующую", async () => {
    const email = "upgraded@example.test";
    положитьПлатную(email, "pay-new-87654321");
    await возвратPaybox(email, "pay-old-11112222");
    expect(
      последнийТариф(),
      "возврат за прошлую покупку понизил действующую: человек потерял тариф, за который заплатил"
    ).toBe("medium");
  });

  test("paypal ведёт себя так же", async () => {
    const email = "pp-upgraded@example.test";
    положитьПлатную(email, "pay-pp-new-99998888");
    await возвратPaypal(email, "pay-pp-old-33334444");
    expect(последнийТариф(), "у paypal возврат за старую покупку понизил действующую").toBe("medium");
  });

  test("нет действующей подписки — понижение пишется как раньше", async () => {
    // Сомневаемся — отзываем.
    const email = "nobody@example.test";
    writeFileSync(файл, "", "utf8");
    await возвратPaybox(email, "pay-any-55556666");
    expect(последнийТариф()).toBe("free");
  });
});
