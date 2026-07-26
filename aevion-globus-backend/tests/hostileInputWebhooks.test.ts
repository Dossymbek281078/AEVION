import { describe, test, expect } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Вебхуки принимают тело ИЗ ИНТЕРНЕТА и ведут к провижинингу подписки. Значит
 * кривое или злонамеренное тело обязано получить осознанный отказ (4xx), а не
 * уронить обработчик в 500.
 *
 * Повод: прогон враждебных входов по денежным ручкам дал три падения подряд
 * (`ownedModules`, `modules`, `promoCode`) — всё воспроизводилось обычным
 * HTTP-запросом, и ни один существующий тест этого не ловил, потому что все
 * слали корректное тело. Вебхуки — следующая по важности поверхность: они
 * доступны любому, кто знает URL.
 *
 * Подписи здесь НЕ подделываются: смысл теста не «пройти проверку», а «не
 * упасть до неё и на ней». Отказ 401/400 — правильный ответ.
 */

const IMPORT_TIMEOUT_MS = 30_000;

let appPromise: Promise<express.Express> | null = null;
function getApp(): Promise<express.Express> {
  if (!appPromise) {
    appPromise = Promise.all([
      import("../src/routes/lemonSqueezyWebhook"),
      import("../src/routes/gumroadWebhook"),
      import("../src/routes/payboxWebhook"),
      import("../src/routes/paypalWebhook"),
    ]).then(([ls, gr, pb, pp]) => {
      const app = express();
      // rawBody нужен обработчикам подписи — повторяем то, что делает index.ts.
      app.use(
        express.json({
          verify: (req: express.Request & { rawBody?: string }, _res, buf) => {
            req.rawBody = buf.toString("utf8");
          },
        }),
      );
      app.use(express.urlencoded({ extended: true }));
      app.use("/api/lemonsqueezy", ls.lemonSqueezyWebhookRouter ?? ls.default);
      app.use("/api/gumroad", gr.gumroadWebhookRouter ?? gr.default);
      app.use("/api/paybox", pb.payboxWebhookRouter ?? pb.default);
      app.use("/api/paypal", pp.paypalWebhookRouter ?? pp.default);
      return app;
    });
  }
  return appPromise;
}

const JUNK_BODIES: unknown[] = [
  {},
  [],
  { meta: 42 },
  { meta: { event_name: 42 }, data: null },
  { meta: { event_name: "subscription_created" }, data: { id: {}, attributes: 42 } },
  { data: { attributes: { user_email: 42, variant_id: [] } } },
  { email: null, sale_id: {}, product_id: [] },
  { pg_order_id: {}, pg_result: "1", pg_sig: 42 },
  { event_type: 42, resource: "строка вместо объекта" },
  { nested: { deep: { deeper: { deepest: "x".repeat(2000) } } } },
];

const PATHS = [
  "/api/lemonsqueezy/webhook",
  "/api/gumroad/webhook",
  "/api/paybox/webhook",
  "/api/paypal/webhook",
];

describe("вебхуки переживают враждебное тело", () => {
  test("ни один путь не отвечает 5xx на мусор", async () => {
    const app = await getApp();
    const failures: string[] = [];
    for (const path of PATHS) {
      for (const body of JUNK_BODIES) {
        const r = await request(app).post(path).send(body as never);
        if (r.status >= 500) failures.push(`${path} ← ${JSON.stringify(body).slice(0, 70)} → ${r.status}`);
      }
    }
    expect(failures).toEqual([]);
  }, IMPORT_TIMEOUT_MS);

  test("🔴 неподписанное событие НЕ приводит к выдаче подписки", async () => {
    // Здесь важен ИНВАРИАНТ ПОВЕДЕНИЯ, а не код ответа. Первая версия теста
    // требовала 4xx и краснела на LemonSqueezy — но там 200 безопасен: при
    // незаданном LEMON_SQUEEZY_WEBHOOK_SECRET роут это ЯВНАЯ ЗАГЛУШКА, которая
    // ничего не провижинит (`mode: "stub"`). Проверять надо не статус, а то,
    // что подписка не выдана: иначе тест ловит форму, а не смысл, и его «чинят»
    // ослаблением защиты.
    const app = await getApp();
    for (const path of PATHS) {
      const r = await request(app)
        .post(path)
        .send({ meta: { event_name: "subscription_created" }, data: { id: "x", attributes: { user_email: "attacker@test.dev" } } });

      const activated = r.status < 400 && /activated|provisioned|upgraded/i.test(JSON.stringify(r.body ?? {}));
      expect(activated, `${path} выдал подписку по НЕПОДПИСАННОМУ событию: ${JSON.stringify(r.body).slice(0, 120)}`).toBe(false);

      // Если ответ успешный — он обязан явно говорить, что событие не принято.
      if (r.status < 400) {
        const body = JSON.stringify(r.body ?? {});
        expect(/stub|ignored|skip|no-?op|false/i.test(body), `${path} ответил 200 без признака «не обработано»: ${body.slice(0, 120)}`).toBe(true);
      }
    }
  }, IMPORT_TIMEOUT_MS);
});
