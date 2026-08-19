import { describe, test, expect, vi } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Заглушка на денежном пути не имеет права утверждать состояние платежа.
 *
 * Найдено 20.08.2026 замером по 52 роутерам. Два маршрута в payments.ts:
 *
 *   GET  /paybox/status/:orderId  -> {status:"pending", amount:null} на ЛЮБОЙ
 *                                    идентификатор. Проверено на проде: два
 *                                    заведомо разных заказа, ответ один.
 *   POST /paybox/callback         -> <pg_status>ok</pg_status> и НИЧЕГО больше.
 *
 * Для PayBox «ok» означает «принято, повторять не нужно». То есть подтверждение
 * оплаты, пришедшее сюда по устаревшей настройке в кабинете, подтверждалось и
 * выбрасывалось — молча, без лога и тревоги.
 *
 * Боевой приёмник существует и здоров: /api/paybox/webhook проверяет подпись
 * pg_sig и отбивает повторы; именно его адрес подставляет payboxProvider в
 * pg_result_url. Проблема не в отсутствии реализации, а в ВТОРОМ маршруте с
 * более очевидным именем, который выглядит рабочим.
 */

const captured: Array<{ err: unknown; ctx: Record<string, unknown> }> = [];
vi.mock("../src/lib/sentry/platform", () => ({
  makeServiceCapture: () => (err: unknown, ctx: Record<string, unknown>) => {
    captured.push({ err, ctx });
  },
}));

const { paymentsRouter } = await import("../src/routes/payments");

function app() {
  const a = express();
  a.use(express.json());
  a.use("/api/payments", paymentsRouter);
  return a;
}

describe("статус оплаты не выдумывается", () => {
  test("не отвечает pending на несуществующий заказ", async () => {
    const res = await request(app()).get("/api/payments/paybox/status/no-such-order-12345");
    expect(res.body?.status, "снова утверждает состояние платежа").not.toBe("pending");
    expect(res.status).toBe(501);
    expect(String(res.body?.message ?? ""), "нет объяснения").toMatch(/webhook/);
  });

  test("контроль: два разных заказа больше не получают одинаковое утверждение", async () => {
    // Именно это равенство и было признаком выдумки.
    const a = await request(app()).get("/api/payments/paybox/status/order-A");
    const b = await request(app()).get("/api/payments/paybox/status/order-B");
    expect(a.body?.status).toBeUndefined();
    expect(b.body?.status).toBeUndefined();
  });
});

describe("уведомление об оплате не выбрасывается молча", () => {
  test("тело попадает в Sentry, ответ для PayBox сохранён", async () => {
    captured.length = 0;
    const payload = { pg_order_id: "ord-77", pg_amount: "4900", pg_sig: "deadbeef" };
    const res = await request(app()).post("/api/payments/paybox/callback").send(payload);

    // Ответ обязан остаться прежним: иначе PayBox начнёт повторять в пустоту.
    expect(res.status).toBe(200);
    expect(res.text).toContain("<pg_status>ok</pg_status>");

    expect(captured.length, "уведомление снова теряется без следа").toBe(1);
    const body = String(captured[0].ctx.body ?? "");
    expect(body, "тело не сохранено — разбирать будет нечего").toContain("ord-77");
    expect(body).toContain("4900");
    expect(captured[0].ctx.canonical, "не назван боевой путь").toBe("/api/paybox/webhook");
  });
});
