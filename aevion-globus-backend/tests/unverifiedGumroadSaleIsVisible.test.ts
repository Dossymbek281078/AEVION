import { describe, test, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";

/**
 * Выдача доступа БЕЗ подтверждения продажи обязана быть видна снаружи.
 *
 * У Gumroad нет подписи вебхука — `GUMROAD_WEBHOOK_SECRET` на проде не задан
 * (проверено 29.08.2026 запросом ИМЁН переменных у сервиса, без значений).
 * Вместо подписи обработчик спрашивает у самого Gumroad: существует ли продажа,
 * тот ли покупатель, тот ли товар. Нет продажи — 401, и это правильно.
 *
 * Но если спросить НЕ УДАЛОСЬ — нет токена, сеть, 5xx у них — доступ выдаётся
 * всё равно, чтобы настоящий покупатель не остался ни с чем. Направление отказа
 * выбрано верно: цена «человек заплатил и не получил» выше цены редкой лишней
 * выдачи.
 *
 * А вот ВИДИМОСТЬ не выбирается. До 29.08 эта ветка писала только в
 * `console.warn`: консоль Railway пролистывается и никем не читается, смотрят
 * Sentry. Пока ветка там молчала, всплеск выдач без подтверждения выглядел бы
 * ровно как обычный день — то есть единственный путь, которым можно получить
 * платное даром, был и самым тихим.
 *
 * Этот тест закрепляет не текст сообщения, а сам факт: сработало — видно.
 */

const captured: Array<{ message: string; ctx: unknown }> = [];

const { mockQuery, mockProvision } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockProvision: vi.fn(),
}));

vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: mockQuery }) }));
vi.mock("../src/lib/sentry/platform", () => ({
  makeServiceCapture: () => (err: unknown, ctx: unknown) => {
    captured.push({ message: err instanceof Error ? err.message : String(err), ctx });
  },
}));
// Провайдер отвечает «проверить не удалось» — ровно тот случай, ради которого
// ветка и существует. Подменяем ЗДЕСЬ, а не ломаем сеть: сломанная сеть дала бы
// тот же путь по случайности, и тест перестал бы отвечать за причину.
vi.mock("../src/lib/payment/gumroadProvider", async (importActual) => {
  // Берём модуль ЦЕЛИКОМ и подменяем одну функцию.
  //
  // Первая редакция вернула `gumroadPaymentProvider: {}` — и обработчик упал на
  // разборе пинга («parseWebhook is not a function»), не дойдя до проверяемой
  // ветки вовсе. Контроль это и поймал: он падал ПЕРВЫМ, до утверждения про
  // Sentry. Без контроля я бы увидел «тревоги нет» и чинил бы продукт вместо
  // стенда — второй раз за вечер тот же капкан.
  const actual = await importActual<typeof import("../src/lib/payment/gumroadProvider")>();
  return {
    ...actual,
    verifyGumroadSaleDetailed: async () => ({ verdict: "unverifiable" as const, sale: null }),
  };
});

const { gumroadWebhookRouter } = await import("../src/routes/gumroadWebhook");
const provisioning = await import("../src/routes/provisioning");
vi.spyOn(provisioning, "provisionSubscription").mockImplementation(mockProvision as never);

function app() {
  const a = express();
  a.use(express.urlencoded({
    extended: true,
    verify: (req, _res, buf) => { (req as unknown as { rawBody?: Buffer }).rawBody = buf; },
  }));
  return a.use("/api/gumroad", gumroadWebhookRouter);
}

let n = 0;
function ping() {
  n += 1;
  return request(app())
    .post("/api/gumroad/webhook")
    .type("form")
    .send({
      sale_id: `unverified_sale_${n}`,
      email: "buyer@test.aev",
      product_permalink: "https://aevion.gumroad.com/l/pyiaz",
      price: "900",
    });
}

beforeEach(() => {
  captured.length = 0;
  mockQuery.mockReset();
  mockQuery.mockResolvedValue({ rows: [] });
  mockProvision.mockReset();
  mockProvision.mockResolvedValue({ subscription: { id: "s1" } });
  delete process.env.GUMROAD_WEBHOOK_SECRET;
  delete process.env.GUMROAD_VERIFY_SALES;
});

describe("непроверенная продажа Gumroad видна снаружи", () => {
  test("контроль: такой пинг вообще принимается, а не отбивается", async () => {
    // Если бы он отбивался, «тревога есть» ниже могло бы значить что угодно.
    const res = await ping();
    expect(res.status, "пинг отклонён — тогда проверка ниже не про эту ветку").toBe(200);
  });

  test("выдача без подтверждения уходит в Sentry, а не только в консоль", async () => {
    await ping();
    const hit = captured.find((c) => c.message.includes("gumroad_sale_unverifiable_provisioned"));
    expect(
      hit,
      `единственный путь выдачи без подтверждения молчит в Sentry; поймано: ${captured.map((c) => c.message).join(", ") || "ничего"}`,
    ).toBeTruthy();
  });

  test("в тревоге назван идентификатор продажи — иначе её не с чем сверить", async () => {
    // Своя проба, а не остатки соседней: `captured` чистится в beforeEach, и
    // первая редакция этой проверки читала пустой список — «опирается на данные
    // соседа» в чистом виде. Поймалось сразу, потому что тест шёл третьим.
    await ping();
    const hit = captured.find((c) => c.message.includes("gumroad_sale_unverifiable_provisioned"));
    expect(hit?.message, "тревога без номера продажи не сверяется ни с чем").toContain(
      "unverified_sale_",
    );
  });
});
