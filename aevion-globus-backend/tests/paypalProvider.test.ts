import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { paypalPaymentProvider, isPaypalConfigured } from "../src/lib/payment/paypalProvider";

// Offline-тесты PayPal-провайдера: маппинг event_type вебхука в PaymentStatus
// и извлечение order_id/custom_id (без сети — verify-webhook-signature и OAuth
// здесь не вызываются, они тестируются в роуте/интеграции).

let prevId: string | undefined;
let prevSecret: string | undefined;

beforeEach(() => {
  prevId = process.env.PAYPAL_CLIENT_ID;
  prevSecret = process.env.PAYPAL_SECRET;
});
afterEach(() => {
  if (prevId === undefined) delete process.env.PAYPAL_CLIENT_ID; else process.env.PAYPAL_CLIENT_ID = prevId;
  if (prevSecret === undefined) delete process.env.PAYPAL_SECRET; else process.env.PAYPAL_SECRET = prevSecret;
});

describe("paypal webhook parsing", () => {
  test("PAYMENT.CAPTURE.COMPLETED → paid, order_id из supplementary_data", () => {
    const body = JSON.stringify({
      event_type: "PAYMENT.CAPTURE.COMPLETED",
      resource: {
        id: "CAP123",
        status: "COMPLETED",
        custom_id: JSON.stringify({ reference: "tier_lite_monthly", module: "healthai" }),
        supplementary_data: { related_ids: { order_id: "ORDER999" } },
        update_time: "2026-06-10T00:00:00Z",
      },
    });
    const out = paypalPaymentProvider.parseWebhook({}, body);
    expect(out.intentId).toBe("paypal:ORDER999");
    expect(out.result.status).toBe("paid");
    const raw = out.result.raw as Record<string, unknown>;
    expect(raw.custom_id).toContain("healthai");
  });

  test("PAYMENT.CAPTURE.REFUNDED → refunded", () => {
    const body = JSON.stringify({
      event_type: "PAYMENT.CAPTURE.REFUNDED",
      resource: { id: "CAP456", status: "REFUNDED" },
    });
    const out = paypalPaymentProvider.parseWebhook({}, body);
    expect(out.result.status).toBe("refunded");
  });

  test("CHECKOUT.ORDER.APPROVED → processing (ещё не captured)", () => {
    const body = JSON.stringify({
      event_type: "CHECKOUT.ORDER.APPROVED",
      resource: { id: "ORDER777", status: "APPROVED" },
    });
    const out = paypalPaymentProvider.parseWebhook({}, body);
    expect(out.result.status).toBe("processing");
    expect(out.intentId).toBe("paypal:ORDER777");
  });

  test("битый JSON → failed/parse_error без throw", () => {
    const out = paypalPaymentProvider.parseWebhook({}, "{not json");
    expect(out.result.status).toBe("failed");
    expect(out.result.reason).toBe("parse_error");
  });
});

describe("paypal configuration gate", () => {
  test("isPaypalConfigured требует и client_id, и secret", () => {
    delete process.env.PAYPAL_CLIENT_ID;
    delete process.env.PAYPAL_SECRET;
    expect(isPaypalConfigured()).toBe(false);
    process.env.PAYPAL_CLIENT_ID = "id";
    expect(isPaypalConfigured()).toBe(false);
    process.env.PAYPAL_SECRET = "sec";
    expect(isPaypalConfigured()).toBe(true);
  });
});
