import { describe, test, expect, vi } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Денежная тревога не имеет права звонить на пробы.
 *
 * Устаревший путь /api/payments/paybox/callback правильно поднимает тревогу,
 * когда на него приходит настоящее уведомление PayBox (оно означает неверную
 * настройку в кабинете кассы, и оплату нужно сверить руками).
 *
 * Но 28.08.2026 единственное срабатывание за неделю пришло с тегом
 * `browser = curl 8.21.0` — то есть это была ручная проба, а не касса. Тревога,
 * которая звонит на пробы, приучает себя не читать, и в тот единственный раз,
 * когда придёт настоящая оплата, её отмахнут вместе с шумом.
 *
 * Различаем по телу: PayBox шлёт application/x-www-form-urlencoded, такой
 * разборщик смонтирован в index.ts, значит у настоящего уведомления поля есть,
 * а у пробы тело пустое.
 *
 * ⚠ Направление отказа: пробой считается ТОЛЬКО полностью пустое тело.
 * Молчание здесь дороже лишнего письма, поэтому любое непустое тело — тревога.
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
  // тот же разборщик, что и на проде — иначе тест мерил бы не тот путь
  a.use(express.urlencoded({ extended: true }));
  a.use("/api/payments", paymentsRouter);
  return a;
}

const ok = (res: { status: number; text: string }) => {
  // Ответ для кассы не меняется ни в одном из случаев: иначе PayBox начнёт
  // повторять уведомление в пустоту.
  expect(res.status).toBe(200);
  expect(res.text).toContain("<pg_status>ok</pg_status>");
};

describe("устаревший путь PayBox: тревога только на настоящее уведомление", () => {
  test("настоящее уведомление (поля pg_*) поднимает тревогу", async () => {
    captured.length = 0;
    const res = await request(app())
      .post("/api/payments/paybox/callback")
      .type("form")
      .send({ pg_order_id: "ord-77", pg_amount: "29.00", pg_sig: "deadbeef" });
    ok(res);
    expect(captured.length, "настоящая оплата прошла молча — это и был исходный дефект").toBe(1);
    expect(String((captured[0].ctx as { body?: string }).body ?? "")).toContain("ord-77");
  });

  test("проба с пустым телом тревогу НЕ поднимает", async () => {
    captured.length = 0;
    const res = await request(app()).post("/api/payments/paybox/callback").type("form").send("");
    ok(res);
    expect(captured.length, "тревога сработала на пробе — к такой привыкают и перестают читать").toBe(0);
  });

  test("контроль: незнакомое непустое тело всё равно поднимает тревогу", async () => {
    // Если касса однажды сменит имена полей, промолчать нельзя.
    captured.length = 0;
    const res = await request(app())
      .post("/api/payments/paybox/callback")
      .type("form")
      .send({ something_else: "1" });
    ok(res);
    expect(captured.length, "непустое тело сочли пробой — так молчанием теряют оплату").toBe(1);
  });
});
