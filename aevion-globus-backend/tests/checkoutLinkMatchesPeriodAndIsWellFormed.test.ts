import { describe, test, expect, vi, beforeEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Сторож: ссылка на оплату ведёт к товару ВЫБРАННОГО срока и не склеена.
 *
 * ДВЕ ДЫРЫ, обе найдены 03.09.2026 и обе денежные.
 *
 * 1. СРОК. По ссылке заказа выбирается товар. До 15.09.2026 это был период
 *    (`tier_${id}_${period}`), и мутация «всегда monthly» НЕ ЛОВИЛАСЬ ничем:
 *    годовой покупатель ушёл бы к месячному товару. С 15.09.2026 тариф — это
 *    срок, ссылка `tier_<ступень>` / `app_<приложение>_<ступень>`, и та же дыра
 *    выглядит так: покупатель Max уходит к товару Lite — платит за месяц и
 *    получает месяц. Прежнее поле `period` больше не читается и не должно
 *    уводить к другому товару.
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

async function сессия(body: Record<string, unknown>) {
  return request(приложение())
    .post("/api/pricing/checkout/session")
    .send({ email: "buyer@example.test", ...body });
}

beforeEach(() => {
  delete process.env.GUMROAD_DEFAULT_PERMALINK;
  for (const k of Object.keys(process.env)) {
    if (k.startsWith("GUMROAD_PERMALINK_") || k.startsWith("LEMON_SQUEEZY_")) delete process.env[k];
  }
});

afterAll(() => {
  process.env = сохранено;
});

describe("ссылка на оплату соответствует выбору", () => {
  test("срок Max ведёт к товару Max, срок Lite — к товару Lite", async () => {
    process.env.GUMROAD_PERMALINK_TIER_MAX = "planet-max-slug";
    process.env.GUMROAD_PERMALINK_TIER_LITE = "planet-lite-slug";

    const год = await сессия({ tierId: "max" });
    expect(год.status, `сессия Max не создалась: ${JSON.stringify(год.body)}`).toBe(200);
    expect(
      String(год.body.url),
      "покупатель Max отправлен к товару Lite: заплатит за месяц и получит месяц"
    ).toContain("planet-max-slug");

    const месяц = await сессия({ tierId: "lite" });
    expect(месяц.status).toBe(200);
    expect(
      String(месяц.body.url),
      "покупатель Lite отправлен к товару Max — это подарок за чужой счёт"
    ).toContain("planet-lite-slug");
  });

  test("прежнее поле period не уводит к товару другого срока", async () => {
    process.env.GUMROAD_PERMALINK_TIER_MAX = "planet-max-slug";
    process.env.GUMROAD_PERMALINK_TIER_LITE = "planet-lite-slug";
    const r = await сессия({ tierId: "lite", period: "annual" });
    expect(r.status).toBe(200);
    expect(String(r.body.url), "старое слово annual увело Lite к годовому товару").toContain("planet-lite-slug");
  });

  test("отдельное приложение ведёт к товару своей ступени", async () => {
    process.env.GUMROAD_PERMALINK_APP_CYBERCHESS_PRO = "chess-pro-slug";
    process.env.GUMROAD_PERMALINK_APP_CYBERCHESS_LITE = "chess-lite-slug";
    process.env.GUMROAD_PERMALINK_TIER_PRO = "planet-pro-slug";
    const r = await сессия({ tierId: "pro", app: "cyberchess" });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(String(r.body.url), "покупка приложения ушла к товару планеты или другой ступени").toContain("chess-pro-slug");
  });

  test("переменная с ПОЛНОЙ ссылкой не даёт склеенный адрес", async () => {
    process.env.GUMROAD_PERMALINK_TIER_MAX = "https://aevion.gumroad.com/l/planet-max-slug";
    const r = await сессия({ tierId: "max" });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const url = String(r.body.url);
    expect(
      (url.match(/https?:\/\//g) ?? []).length,
      `ссылка склеена и ведёт на 404: ${url}`
    ).toBe(1);
    expect(url, "слаг потерялся при нормализации").toContain("planet-max-slug");
  });

  test("КОНТРОЛЬ: обычный слаг по-прежнему работает", async () => {
    // Иначе «не склеено» удовлетворялось бы кодом, который ломает и нормальный
    // случай тоже.
    process.env.GUMROAD_PERMALINK_TIER_MAX = "planet-max-slug";
    const r = await сессия({ tierId: "max" });
    expect(String(r.body.url)).toBe(
      "https://app.gumroad.com/l/planet-max-slug?wanted_email=buyer%40example.test"
    );
  });
});
