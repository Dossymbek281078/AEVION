/**
 * Возврат за «Verified» оставляет значок — и это должно быть ВИДНО.
 *
 * Verified у бюро — разовая покупка. Отдавать её обратно автоматически нельзя:
 * возврат бывает спорным (chargeback), и автоотзыв наказал бы честного
 * покупателя посреди разбирательства. Решение сохранить статус осознанное, и
 * этот тест его НЕ оспаривает.
 *
 * Оспаривается другое: до 28.08.2026 след был `console.log` — строка среди
 * тысяч. Человек, оплативший значок, вернувший деньги и сохранивший значок на
 * сертификате, не появлялся нигде. Механизм отзыва при этом существует
 * (`POST /api/bureau/admin/cert/:certId/revoke-verification`), просто никто не
 * узнавал, что пора им воспользоваться.
 *
 * Проверяется ПОВЕДЕНИЕ: ответ прежний, след громкий и называет, что делать.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import request from "supertest";

let app: express.Express;

async function build() {
  const { gumroadWebhookRouter } = await import("../src/routes/gumroadWebhook");
  const a = express();
  // `verify` сохраняет СЫРЫЕ байты — ровно как index.ts. Без этого разбор
  // пинга получает пустоту, вебхук честно отвечает `no_email`, и тест
  // проверяет не то, что обещает. Первая версия оснастки так и падала:
  // виноват был мой стенд, а не код.
  a.use(
    express.urlencoded({
      extended: true,
      verify: (req, _res, buf) => {
        (req as unknown as { rawBody?: Buffer }).rawBody = buf;
      },
    }),
  );
  a.use("/api/gumroad", gumroadWebhookRouter);
  return a;
}

// прогрев модуля: первый динамический import большого роутера стоит секунд, и
// внутри бюджета первого теста под нагрузкой он однажды не уложился в 30 с.
beforeAll(async () => {
  app = await build();
});

beforeEach(() => {
  // Без секрета подпись не проверяется, а подтверждение продажи невозможно —
  // ровно тот режим, в котором Gumroad живёт на проде сегодня.
  delete process.env.GUMROAD_WEBHOOK_SECRET;
  process.env.GUMROAD_VERIFY_SALES = "0";
  // Ссылка "bureau-verified" достижима ТОЛЬКО через явное сопоставление
  // товара переменной окружения — умолчания у неё нет. Настраиваем так же,
  // как это сделано на проде, иначе пинг уходит в ветку "неизвестный товар"
  // и тест проверяет не то, что обещает.
  process.env.GUMROAD_PRODUCT_BUREAUVERIFIED = "bureau-verified";
});

afterEach(() => {
  delete process.env.GUMROAD_VERIFY_SALES;
  delete process.env.GUMROAD_PRODUCT_BUREAUVERIFIED;
  vi.restoreAllMocks();
});

/** Пинг возврата за Verified, как его шлёт Gumroad: form-encoded. */
async function refundPing(saleId: string) {
  return request(app)
    .post("/api/gumroad/webhook")
    .type("form")
    .send({
      sale_id: saleId,
      email: "buyer@example.com",
      product_id: "bureauverified",
      refunded: "true",
    });
}

describe("возврат за Verified: значок остаётся, но след громкий", () => {
  it("ответ прежний — политику не меняли", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await refundPing("sale_refund_1");
    // 200 и «ignored» — это осознанное поведение, а не недосмотр.
    expect(res.status).toBe(200);
    expect(String(res.body.ignored ?? "")).toContain("bureau");
    expect(spy).toHaveBeenCalled();
  });

  it("след называет ЧТО случилось и ЧТО делать", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await refundPing("sale_refund_2");
    const said = spy.mock.calls.map((c) => c.join(" ")).join(" ");
    // Без адреса отзыва след бесполезен: человек узнает о поводе и не поймёт,
    // куда идти.
    expect(said).toContain("Verified");
    expect(said).toContain("revoke-verification");
  });

  it("успешная оплата такого следа НЕ оставляет", async () => {
    // Отрицательный контроль: иначе оба теста были бы зелёными и на коде,
    // который кричит на каждый пинг, а такой сторож отключают в первый день.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await request(app)
      .post("/api/gumroad/webhook")
      .type("form")
      .send({
        sale_id: "sale_paid_1",
        email: "buyer@example.com",
        product_id: "bureauverified",
      });
    const said = spy.mock.calls.map((c) => c.join(" ")).join(" ");
    expect(said).not.toContain("revoke-verification");
  });
});
