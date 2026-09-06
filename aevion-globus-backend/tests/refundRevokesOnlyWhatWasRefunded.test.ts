import { describe, test, expect, vi, beforeEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
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

describe("правило одно на все кассы", () => {
  const РОУТЫ = resolve(__dirname, "../src/routes");
  const КАССЫ = [
    "payboxWebhook.ts",
    "paypalWebhook.ts",
    "gumroadWebhook.ts",
    "lemonSqueezyWebhook.ts",
  ];

  test("КОНТРОЛЬ: файлы касс на месте и читаются", () => {
    // Иначе «все зовут правило» удовлетворялось бы пустым списком файлов.
    const есть = readdirSync(РОУТЫ);
    for (const к of КАССЫ) expect(есть, `нет файла ${к}`).toContain(к);
  });

  test("правило объявлено ОДИН раз и его зовут ВСЕ четыре кассы", async () => {
    // Сперва я написал этого помощника дважды — в paybox и paypal — то есть
    // повторил ровно ту ошибку, из-за которой годовой период у одной кассы
    // из четырёх зашивался месячным: пока копий несколько, отставшая ничем
    // себя не выдаёт.
    // Только файлы: readdirSync отдаёт и подкаталоги, а readFileSync на
    // каталоге бросает EISDIR — поймал этим же прогоном.
    const объявления = readdirSync(РОУТЫ)
      .filter((f) => f.endsWith(".ts"))
      .filter((f) =>
        readFileSync(join(РОУТЫ, f), "utf8").includes("function возвратКасаетсяДействующей")
      );
    expect(объявления, "правило объявлено не в одном месте").toEqual(["provisioning.ts"]);

    // Мало ПОЗВАТЬ правило — запись понижения должна быть им ЗАКРЫТА.
    // Первая версия требовала только вызова, и мутация «убрать `if (отзываем)`
    // у gumroad» её пережила: вызов на месте, а понижение пишется всё равно.
    const безПравила = КАССЫ.filter((к) => {
      const текст = readFileSync(join(РОУТЫ, к), "utf8");
      return (
        !текст.includes("возвратКасаетсяДействующей(") ||
        !текст.includes("if (отзываем) writeSubscription(downgrade);")
      );
    });
    expect(
      безПравила,
      `эти кассы отзывают ЛЮБУЮ подписку, а не оплаченную этим платежом: ${безПравила.join(", ")}`
    ).toEqual([]);
  });

  test("само правило: чужой платёж не трогает действующую, свой — трогает", async () => {
    const { возвратКасаетсяДействующей } = await import("../src/routes/provisioning");
    const платная = {
      id: "sub_paybox_pay-new-87654321",
      ts: "", email: "a@b.c", tierId: "medium", period: "monthly",
      seats: 1, modules: [], trialDays: 0,
      providerPaymentId: "pay-new-87654321",
    } as never;
    expect(возвратКасаетсяДействующей(платная, "pay-new-87654321"), "свой платёж не отзывает").toBe(true);
    expect(возвратКасаетсяДействующей(платная, "pay-old-11112222"), "чужой платёж отзывает").toBe(false);
    // Сомневаемся — отзываем.
    expect(возвратКасаетсяДействующей(null, "что угодно")).toBe(true);
    expect(возвратКасаетсяДействующей({ ...(платная as object), tierId: "free" } as never, "x")).toBe(true);
    expect(возвратКасаетсяДействующей(платная, ""), "без идентификатора отзываем").toBe(true);

    // РАЗВОДИМ два пути. У этой записи поле `providerPaymentId` говорит одно,
    // а номер подписки — другое: запасной путь (по номеру) ответил бы
    // «отзывать», основной (по полю) — «не трогать». Без такого случая
    // мутация «не сравнивать поле вовсе» проходит незамеченной: оба пути
    // дают одинаковый ответ на обычных данных. Поймано мутацией 05.09.2026.
    const спорная = {
      ...(платная as object),
      id: "sub_paybox_pay-old-11112222",
      providerPaymentId: "pay-new-87654321",
    } as never;
    expect(
      возвратКасаетсяДействующей(спорная, "pay-old-11112222"),
      "решает НОМЕР подписки вместо поля платежа — основное сравнение выключено"
    ).toBe(false);
  });
});
