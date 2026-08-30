/**
 * Без секрета вебхук Lemon Squeezy — заглушка, и это должно быть ВИДНО.
 *
 * Через этот вебхук идут все семь товаров каталога. Без
 * LEMON_SQUEEZY_WEBHOOK_SECRET маршрут POST отвечает `{ok:true, mode:"stub"}`:
 * магазин считает доставку успешной, повторов не будет, провижининга нет.
 * Оплаченная покупка исчезает, и никто не узнаёт.
 *
 * Ответ 200 здесь оставлен НАМЕРЕННО: 5xx заставил бы магазин повторять
 * доставку, а при сознательно пустом секрете (превью, локальный запуск) это
 * поток повторов. Меняется не ответ, а видимость: снаружи есть GET-состояние,
 * изнутри — ошибка в журнал и в Sentry.
 *
 * Проверяется поведение при разных переменных, а не текст исходника.
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from "vitest";
import express from "express";
import request from "supertest";

const KEY = "LEMON_SQUEEZY_WEBHOOK_SECRET";
let saved: string | undefined;

beforeEach(() => {
  saved = process.env[KEY];
  delete process.env[KEY];
});

afterEach(() => {
  if (saved === undefined) delete process.env[KEY];
  else process.env[KEY] = saved;
  vi.restoreAllMocks();
});

async function makeApp() {
  const { lemonSqueezyWebhookRouter } = await import("../src/routes/lemonSqueezyWebhook");
  const app = express();
  app.use(express.json());
  app.use("/api/lemonsqueezy", lemonSqueezyWebhookRouter);
  return app;
}

// прогрев модуля: первый динамический import большого роутера стоит секунд, и
// внутри бюджета первого теста под нагрузкой он однажды не уложился в 30 с
// (сосед по набору дал ложную красную на ровном месте). Дальше импорт берётся
// из кеша, поэтому достаточно оплатить его один раз в хуке.
beforeAll(async () => {
  await makeApp();
});

describe("вебхук Lemon Squeezy честно называет своё состояние", () => {
  it("без секрета состояние — заглушка, провижининга нет", async () => {
    const app = await makeApp();
    const res = await request(app).get("/api/lemonsqueezy/webhook");
    expect(res.status).toBe(200);
    expect(res.body.signed).toBe(false);
    // Главное поле названо отрицанием: true = покупки НЕ доходят.
    expect(res.body.purchasesDropped).toBe(true);
    expect(res.body.mode).toBe("stub");
  });

  it("с секретом состояние — рабочее", async () => {
    process.env[KEY] = "test-secret";
    const app = await makeApp();
    const res = await request(app).get("/api/lemonsqueezy/webhook");
    expect(res.body.signed).toBe(true);
    expect(res.body.purchasesDropped).toBe(false);
    expect(res.body.mode).toBe("live");
  });

  it("секрет наружу не отдаётся", async () => {
    process.env[KEY] = "super-secret-ls-value";
    const app = await makeApp();
    const res = await request(app).get("/api/lemonsqueezy/webhook");
    expect(JSON.stringify(res.body)).not.toContain("super-secret-ls-value");
  });

  it("пинг в режиме заглушки оставляет ГРОМКИЙ след, а не тишину", async () => {
    // Раньше здесь был console.log — строчка среди тысяч, которую никто не
    // читает. Ошибка попадает и в журнал ошибок, и в Sentry.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const app = await makeApp();
    const res = await request(app)
      .post("/api/lemonsqueezy/webhook")
      .send({ meta: { event_name: "subscription_created" } });

    // Ответ остаётся 200 — это осознанное решение, а не недосмотр.
    expect(res.status).toBe(200);
    expect(res.body.mode).toBe("stub");

    expect(spy).toHaveBeenCalled();
    const said = spy.mock.calls.map((c) => c.join(" ")).join(" ");
    // След обязан называть ПРИЧИНУ и ПОСЛЕДСТВИЕ, иначе он бесполезен.
    expect(said).toContain("LEMON_SQUEEZY_WEBHOOK_SECRET");
    expect(said.toLowerCase()).toContain("не провижинен");
  });

  it("с секретом путь заглушки не срабатывает", async () => {
    // Отрицательный контроль: без него тест выше был бы зелёным и на коде,
    // который кричит ВСЕГДА.
    process.env[KEY] = "test-secret";
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const app = await makeApp();
    await request(app)
      .post("/api/lemonsqueezy/webhook")
      .send({ meta: { event_name: "subscription_created" } });
    const said = spy.mock.calls.map((c) => c.join(" ")).join(" ");
    expect(said).not.toContain("STUB");
  });
});
