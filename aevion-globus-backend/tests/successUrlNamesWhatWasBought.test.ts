import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { buildSuccessUrl } from "../src/lib/payment/successUrl";
import type { PaymentIntentInput } from "../src/lib/payment/provider";

/**
 * Сторож: страница после оплаты называет то, за что заплатили.
 *
 * ЗАЧЕМ. Страница /pricing/checkout/success выбирает продукт по appId, а
 * класть его в адрес возврата не умел ни один провайдер. Значит запасной
 * вариант видел КАЖДЫЙ покупатель: заплативший за QSign, QLearn или QCoreAI
 * читал «Pro активирован» и кнопку «Открыть QRight». Это первое, что человек
 * видит сразу после списания денег.
 *
 * Проверяем СЛЕДСТВИЕ, а не наличие параметра: утверждение «в адресе есть
 * appId» пережило бы переименование параметра молча.
 */
const вход = (over: Partial<PaymentIntentInput> = {}): PaymentIntentInput =>
  ({
    reference: "tier_lite_monthly",
    amountCents: 1900,
    currency: "USD",
    description: "AEVION Lite",
    successAppId: "qsign",
    ...over,
  }) as PaymentIntentInput;

describe("адрес возврата называет купленное", () => {
  it("несёт и продукт, и тариф, и период", () => {
    const url = new URL(buildSuccessUrl("https://aevion.app", вход(), { provider: "paybox" }));
    expect(url.searchParams.get("appId")).toBe("qsign");
    expect(url.searchParams.get("tier")).toBe("lite");
    expect(url.searchParams.get("period")).toBe("monthly");
  });

  it("на наборе продукт не называется — врать нельзя", () => {
    const url = new URL(
      buildSuccessUrl("https://aevion.app", вход({ successAppId: undefined }), {})
    );
    expect(url.searchParams.get("appId")).toBeNull();
  });

  it("прежние читатели не сломаны: ref и флаг провайдера на месте", () => {
    const url = new URL(
      buildSuccessUrl("https://aevion.app", вход(), { flags: { paybox: "1" } })
    );
    expect(url.searchParams.get("ref")).toBe("tier_lite_monthly");
    expect(url.searchParams.get("paybox")).toBe("1");
  });

  it("ни один провайдер не собирает этот адрес сам", () => {
    // Копий было три, и разошлись они именно поэтому.
    const dir = join(__dirname, "..", "src", "lib", "payment");
    const файлы = readdirSync(dir).filter(
      (f) => f.endsWith(".ts") && f !== "successUrl.ts" && statSync(join(dir, f)).isFile()
    );
    expect(файлы.length, "провайдеров не найдено — обход сломан").toBeGreaterThan(3);

    const сами = файлы.filter((f) =>
      readFileSync(join(dir, f), "utf8").includes("/pricing/checkout/success?")
    );
    expect(сами, "провайдер снова собирает адрес возврата сам").toEqual([]);
  });
});
