import { describe, test, expect, vi, beforeEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Сторож: ссылка на оплату ведёт к товару ВЫБРАННОГО периода и не склеена.
 *
 * ДВЕ ДЫРЫ, обе найдены 03.09.2026 и обе денежные.
 *
 * 1. ПЕРИОД. Ссылка заказа строится как `tier_${id}_${period}`, и по ней
 *    выбирается товар. Мутация «всегда monthly» НЕ ЛОВИЛАСЬ ничем: годовой
 *    покупатель ушёл бы к месячному товару — заплатил бы месячную цену и
 *    получил месячный доступ.
 *
 * 2. ФОРМА ССЫЛКИ. Префикс `https://app.gumroad.com/l/` приклеивался слепо.
 *    Значение переменной может быть полной ссылкой со страницы товара — это
 *    самое естественное действие при настройке, — и тогда получалось
 *    `https://app.gumroad.com/l/https://aevion.gumroad.com/l/...`: ручка
 *    отвечает 200, покупатель попадает на 404, тариф купить нельзя, и
 *    снаружи это неотличимо от исправной работы.
 */
vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => () => {} }));

const сохранено = { ...process.env };
const { checkoutRouter } = await import("../src/routes/checkout");

function приложение() {
  const a = express();
  a.use(express.json());
  a.use("/api/pricing/checkout", checkoutRouter);
  return a;
}

async function сессия(period: "monthly" | "annual") {
  return request(приложение())
    .post("/api/pricing/checkout/session")
    .send({ tierId: "full", period, email: "buyer@example.test" });
}

beforeEach(() => {
  delete process.env.GUMROAD_DEFAULT_PERMALINK;
});

afterAll(() => {
  process.env = сохранено;
});

describe("ссылка на оплату соответствует выбору", () => {
  test("годовой период ведёт к ГОДОВОМУ товару, месячный — к месячному", async () => {
    process.env.GUMROAD_PERMALINK_TIER_FULL_ANNUAL = "full-annual-slug";
    process.env.GUMROAD_PERMALINK_TIER_FULL_MONTHLY = "full-monthly-slug";

    const год = await сессия("annual");
    expect(год.status, `годовая сессия не создалась: ${JSON.stringify(год.body)}`).toBe(200);
    expect(
      String(год.body.url),
      "годовой покупатель отправлен к МЕСЯЧНОМУ товару: заплатит месячную цену и получит месячный доступ"
    ).toContain("full-annual-slug");

    const месяц = await сессия("monthly");
    expect(
      String(месяц.body.url),
      "месячный покупатель отправлен к годовому товару — это подарок за чужой счёт"
    ).toContain("full-monthly-slug");
  });

  test("переменная с ПОЛНОЙ ссылкой не даёт склеенный адрес", async () => {
    process.env.GUMROAD_PERMALINK_TIER_FULL_ANNUAL = "https://aevion.gumroad.com/l/full-annual-slug";
    const r = await сессия("annual");
    const url = String(r.body.url);
    expect(
      (url.match(/https?:\/\//g) ?? []).length,
      `ссылка склеена и ведёт на 404: ${url}`
    ).toBe(1);
    expect(url, "слаг потерялся при нормализации").toContain("full-annual-slug");
  });

  test("КОНТРОЛЬ: обычный слаг по-прежнему работает", async () => {
    // Иначе «не склеено» удовлетворялось бы кодом, который ломает и нормальный
    // случай тоже.
    process.env.GUMROAD_PERMALINK_TIER_FULL_ANNUAL = "full-annual-slug";
    const r = await сессия("annual");
    expect(String(r.body.url)).toBe(
      "https://app.gumroad.com/l/full-annual-slug?wanted_email=buyer%40example.test"
    );
  });
});
