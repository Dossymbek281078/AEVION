import { describe, test, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Сторож: запрошенный пробный период не игнорируется МОЛЧА.
 *
 * ЗАМЕР 04.09.2026, пробой. `trial: true` и `trial: false` дают ПОЛНОСТЬЮ
 * одинаковый ответ — тот же платёжный адрес, та же сумма. Причина: число дней
 * вычисляется, но используется только в ветке нулевой цены, а сумма считается
 * расчётом, который о пробном периоде не знает вовсе (в data/pricing.ts слова
 * trial нет). При обычной цене ветка не берётся, и 14 дней никуда не попадают —
 * все четыре кассы записывают потом trialDays: 0.
 *
 * При этом кнопка на странице цен обещает «Попробовать 14 дней бесплатно».
 *
 * ЧЕГО ЭТОТ СТОРОЖ НЕ ТРЕБУЕТ. Он не требует, чтобы пробный период заработал:
 * как он должен работать — решение основателя, и оно может жить на стороне
 * товара у провайдера, чего из нашего кода не видно. Охраняется ровно одно:
 * расхождение между обещанием и поведением ВИДНО нам.
 */
const { тревоги } = vi.hoisted(() => ({ тревоги: [] as string[] }));

vi.mock("../src/lib/sentry/platform", () => ({
  makeServiceCapture: () => (e: unknown) => {
    тревоги.push(e instanceof Error ? e.message : String(e));
  },
}));

process.env.GUMROAD_PERMALINK_TIER_LITE_MONTHLY = "lite-monthly-slug";

const { checkoutRouter } = await import("../src/routes/checkout");

function приложение() {
  const a = express();
  a.use(express.json());
  a.use("/api/pricing/checkout", checkoutRouter);
  return a;
}

async function сессия(trial: boolean) {
  return request(приложение())
    .post("/api/pricing/checkout/session")
    .send({ tierId: "lite", period: "monthly", seats: 1, trial, email: "buyer@example.test" });
}

beforeEach(() => {
  тревоги.length = 0;
});

describe("расхождение обещания и поведения видно", () => {
  test("КОНТРОЛЬ: обычная покупка проходит и тревоги НЕ даёт", async () => {
    // Без этого «тревога есть» удовлетворялось бы кодом, который шлёт её на
    // каждую покупку, — то есть машиной ложных тревог на денежном пути.
    const r = await сессия(false);
    expect(r.status, `обычная покупка сломалась: ${JSON.stringify(r.body)}`).toBe(200);
    expect(тревоги, "тревога ушла на покупке БЕЗ пробного периода").toEqual([]);
  });

  test("запрошенный пробный период при платной сумме оставляет след", async () => {
    const r = await сессия(true);
    expect(r.status).toBe(200);
    expect(
      тревоги,
      "пробный период запрошен, не применён, и следа нет: человек нажал «14 дней бесплатно» и заплатил сразу, а мы об этом не знаем"
    ).toContain("checkout_trial_requested_but_not_applied");
  });

  test("ответ при пробном периоде тот же — это и есть предмет тревоги", async () => {
    // Фиксируем ФАКТ, ради которого тревога заведена: если однажды пробный
    // период заработает и ответы разойдутся, этот тест покраснеет и заставит
    // пересмотреть тревогу вместе с ним.
    const сТриалом = await сессия(true);
    const без = await сессия(false);
    expect(
      String(сТриалом.body.url),
      "ответы разошлись — пробный период заработал, тревогу и этот сторож надо пересмотреть"
    ).toBe(String(без.body.url));
  });
});
