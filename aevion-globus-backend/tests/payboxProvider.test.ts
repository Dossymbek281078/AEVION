import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { createHash } from "node:crypto";
import { payboxPaymentProvider, isPayboxConfigured } from "../src/lib/payment/payboxProvider";

// Smoke-тесты подписи PayBox/Freedom Pay. Сеть не трогаем — проверяем только
// детерминированный алгоритм pg_sig в parseWebhook (валидная подпись → paid,
// подделанная → invalid_signature) и гейт конфигурации.

const SECRET = "test_secret_key";
const SCRIPT = "webhook";

/** Та же формула, что в провайдере: md5(script;sorted_values;secret). */
function sign(script: string, params: Record<string, string>, secret: string): string {
  const keys = Object.keys(params).filter((k) => k !== "pg_sig").sort();
  return createHash("md5").update([script, ...keys.map((k) => params[k]), secret].join(";")).digest("hex");
}

function encode(params: Record<string, string>): string {
  return new URLSearchParams(params).toString();
}

let prevSecret: string | undefined;
let prevMerchant: string | undefined;
let prevScript: string | undefined;

beforeEach(() => {
  prevSecret = process.env.PAYBOX_SECRET;
  prevMerchant = process.env.PAYBOX_MERCHANT_ID;
  prevScript = process.env.PAYBOX_RESULT_SCRIPT_NAME;
  process.env.PAYBOX_SECRET = SECRET;
  process.env.PAYBOX_RESULT_SCRIPT_NAME = SCRIPT;
});

afterEach(() => {
  if (prevSecret === undefined) delete process.env.PAYBOX_SECRET; else process.env.PAYBOX_SECRET = prevSecret;
  if (prevMerchant === undefined) delete process.env.PAYBOX_MERCHANT_ID; else process.env.PAYBOX_MERCHANT_ID = prevMerchant;
  if (prevScript === undefined) delete process.env.PAYBOX_RESULT_SCRIPT_NAME; else process.env.PAYBOX_RESULT_SCRIPT_NAME = prevScript;
});

describe("paybox webhook signature", () => {
  test("валидная подпись успешной оплаты → paid + email/order извлечены", () => {
    const params: Record<string, string> = {
      pg_order_id: "tier_lite_monthly_1700000000",
      pg_payment_id: "98765",
      pg_result: "1",
      pg_user_contact_email: "buyer@example.kz",
      pg_salt: "abc123",
    };
    params.pg_sig = sign(SCRIPT, params, SECRET);

    const out = payboxPaymentProvider.parseWebhook({}, encode(params));
    expect(out.intentId).toBe("paybox:98765");
    expect(out.result.status).toBe("paid");
    const raw = out.result.raw as Record<string, string>;
    expect(raw.pg_user_contact_email).toBe("buyer@example.kz");
    expect(raw.pg_order_id).toBe("tier_lite_monthly_1700000000");
  });

  test("подделанная подпись → invalid_signature (failed)", () => {
    const params: Record<string, string> = {
      pg_order_id: "tier_full_annual_1700000000",
      pg_payment_id: "55555",
      pg_result: "1",
      pg_salt: "zzz",
      pg_sig: "deadbeefdeadbeefdeadbeefdeadbeef",
    };
    const out = payboxPaymentProvider.parseWebhook({}, encode(params));
    expect(out.result.status).toBe("failed");
    expect(out.result.reason).toBe("invalid_signature");
  });

  test("отказ оплаты с валидной подписью → failed (не invalid_signature)", () => {
    const params: Record<string, string> = {
      pg_order_id: "tier_lite_monthly_1700000000",
      pg_payment_id: "111",
      pg_result: "0",
      pg_failure_description: "insufficient_funds",
      pg_salt: "s",
    };
    params.pg_sig = sign(SCRIPT, params, SECRET);
    const out = payboxPaymentProvider.parseWebhook({}, encode(params));
    expect(out.result.status).toBe("failed");
    expect(out.result.reason).toBe("insufficient_funds");
  });
});

describe("paybox configuration gate", () => {
  test("isPayboxConfigured требует и merchant_id, и secret", () => {
    delete process.env.PAYBOX_MERCHANT_ID;
    expect(isPayboxConfigured()).toBe(false);
    process.env.PAYBOX_MERCHANT_ID = "12345";
    expect(isPayboxConfigured()).toBe(true);
  });
});
