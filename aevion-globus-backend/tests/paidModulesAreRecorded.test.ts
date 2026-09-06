import { describe, test, expect, vi, beforeEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Сторож: за сколько модулей заплатили — столько и записано.
 *
 * ЗАМЕР 04.09.2026. В кассу уезжал ТОЛЬКО первый модуль и только для Lite
 * (`checkout.ts`: `(body.modules ?? [])[0]`), а вебхуки писали
 * `modules: module ? [module] : []`. Цена при этом считается по ВСЕМ
 * выбранным — это закреплено сторожем liteIncludesOneModuleInThePrice
 * («модуль сверх слота уже прибавляет к цене»).
 *
 * ПОЧЕМУ ЭТО ХУЖЕ, ЧЕМ РАСХОЖДЕНИЕ УЧЁТА. `planGate.isModuleEntitled`
 * пускает к модулю на Lite только если он записан среди выбранных. Значит
 * второй и третий оплаченные модули не открывались вовсе: оплачено и не
 * выдано.
 *
 * ⚠ ГРАНИЦА. Только paybox и paypal — единственные кассы, которые получают
 * нашу сумму и списывают её. У Lemon Squeezy и Gumroad списывают цену
 * товара, то есть за один модуль, и запись одного там СООТВЕТСТВУЕТ оплате.
 * Не копируйте проверку туда, пока не решён пункт 8 записки основателя.
 *
 * ⚠ ЧЕГО СТОРОЖ НЕ ОБЕЩАЕТ. Что докупленный модуль ОТКРОЕТСЯ на medium: там
 * `isModuleEntitled` выбранные модули не спрашивает вовсе. Это вопрос о
 * продукте. Здесь охраняется одно — запись отражает оплаченное.
 */
const каталог = mkdtempSync(join(tmpdir(), "aevion-mods-"));
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

async function черезPaybox(доп: Record<string, string>) {
  n += 1;
  полезная = {
    pg_user_contact_email: `pb-${n}@example.test`,
    pg_order_id: "tier_lite_monthly",
    pg_payment_id: `mods-pb-${n}`,
    ...доп,
  };
  return request(приложение("/api/paybox", payboxWebhookRouter)).post("/api/paybox/webhook").send();
}

async function черезPaypal(доп: Record<string, unknown>) {
  n += 1;
  полезнаяPaypal = {
    id: `mods-pp-${n}`,
    custom_id: JSON.stringify({ reference: "tier_lite_monthly", ...доп }),
    payer: { email_address: `pp-${n}@example.test` },
  };
  return request(приложение("/api/paypal", paypalWebhookRouter)).post("/api/paypal/webhook").send();
}

function записаныМодули(): string[] | undefined {
  if (!existsSync(файл)) return undefined;
  const строки = readFileSync(файл, "utf8").split("\n").filter((l) => l.trim());
  if (!строки.length) return undefined;
  return JSON.parse(строки[строки.length - 1]).modules;
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterAll(() => {
  try { rmSync(каталог, { recursive: true, force: true }); } catch { /* уже нет */ }
  delete process.env.SUBSCRIPTIONS_FILE;
});

describe("оплаченные модули записываются", () => {
  test("КОНТРОЛЬ: без модулей не записывается ничего", async () => {
    // Иначе «записаны три» удовлетворялось бы кодом, который приписывает
    // модули всем подряд, то есть раздаёт платное даром.
    await черезPaybox({});
    expect(записаныМодули(), "покупка без модулей получила модули").toEqual([]);
  });

  test("paybox: оплачены три модуля — записаны все три", async () => {
    await черезPaybox({ pg_param_modules: "qsign,qright,healthai" });
    expect(
      записаныМодули(),
      "оплачены три модуля, записан один: второй и третий не откроются — оплачено и не выдано"
    ).toEqual(["qsign", "qright", "healthai"]);
  });

  test("paypal: список тоже доезжает", async () => {
    // Сестринская касса: охранять одну и оставить вторую — та самая
    // асимметрия, из-за которой класс и живёт.
    await черезPaypal({ modules: "qsign,qcoreai" });
    expect(записаныМодули(), "paypal не довозит список модулей").toEqual(["qsign", "qcoreai"]);
  });

  test("СТАРАЯ ФОРМА не ломается: одиночный модуль читается по-прежнему", async () => {
    // Уведомления, отправленные до этой правки, касса может доставить
    // повторно. Если бы новый разбор их не понимал, повтор доставки выдал
    // бы подписку БЕЗ модуля, за который заплатили.
    await черезPaybox({ pg_param_module: "qsign" });
    expect(записаныМодули(), "старая форма перестала читаться").toEqual(["qsign"]);
  });

  test("мусор и повторы отсеиваются, число ограничено", async () => {
    // Заведомо БОЛЬШЕ предела: иначе «список ограничен» проверялось бы там,
    // где обрезка не срабатывает вовсе. Предел подняли до 100, потому что
    // в каталоге 43 модуля и прежние 20 резали честную покупку.
    const много = Array.from({ length: 150 }, (_v, i) => `mod${i}`).join(",");
    await черезPaybox({ pg_param_modules: `qsign,qsign,ПЛОХОЙ,../etc,${много}` });
    const записано = записаныМодули() ?? [];
    expect(записано.filter((m) => m === "qsign"), "повтор не схлопнут").toHaveLength(1);
    expect(записано, "негодный идентификатор попал в запись").not.toContain("../etc");
    expect(записано.length, "длина списка не ограничена").toBeLessThanOrEqual(100);
    expect(записано.length, "обрезка не сработала — проверять было нечего").toBe(100);
  });
});
