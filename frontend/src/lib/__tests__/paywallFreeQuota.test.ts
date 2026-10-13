/*
 * Отказ по бесплатной норме (402 free_quota_exceeded) поднимает окно тарифа.
 * Замер прода 13.10.2026 (окно Приложения-31.12): нормы бюро, HealthAI и
 * QVenture включены, а перехватчик ловил только upgrade_required — гость
 * видел «Не удалось» или голый код ошибки без ссылки на оплату.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { installPaywallInterceptor, PAYWALL_EVENT, стенаИзНормы, type PaywallPayload } from "../paywall";

// Ровно та форма, что отдаёт бэкенд: aevion-globus-backend/src/lib/freeActionQuota.ts, отказПоНорме.
const НОРМА_402 = {
  error: "free_quota_exceeded",
  module: "healthai",
  used: 2,
  freePerMonth: 1,
  upgradeUrl: "https://aevion.app/pricing",
  message: "Бесплатная норма на этот месяц исчерпана (1). Подписка снимает ограничение — оформить: https://aevion.app/pricing",
};

describe("стенаИзНормы", () => {
  it("отказ по норме превращается в стену с адресом оплаты и текстом сервера", () => {
    const с = стенаИзНормы(НОРМА_402);
    expect(с).not.toBeNull();
    expect(с!.module).toBe("healthai");
    expect(с!.upgradeUrl).toBe("https://aevion.app/pricing");
    expect(с!.message).toContain("норма");
    expect(с!.requiredTiers).not.toContain("free");
  });

  it("КОНТРОЛЬ: прочие 402 и битые тела стеной не считаются", () => {
    expect(стенаИзНормы({ ...НОРМА_402, error: "payment_failed" })).toBeNull();
    expect(стенаИзНормы({ ...НОРМА_402, upgradeUrl: undefined })).toBeNull();
    expect(стенаИзНормы(null)).toBeNull();
    expect(стенаИзНормы("free_quota_exceeded")).toBeNull();
  });
});

describe("перехватчик: 402 по норме поднимает окно тарифа", () => {
  let origFetch: typeof fetch;
  beforeEach(() => {
    origFetch = window.fetch;
    delete (window as unknown as Record<symbol, unknown>)[Symbol.for("aevion.paywall.fetchPatched")];
  });
  afterEach(() => {
    window.fetch = origFetch;
  });

  const ответ = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  it("событие окна приходит, а тело остаётся читаемым для страницы", async () => {
    window.fetch = vi.fn().mockResolvedValue(ответ(402, НОРМА_402));
    installPaywallInterceptor();
    const handler = vi.fn();
    window.addEventListener(PAYWALL_EVENT, handler as EventListener);
    const res = await window.fetch("/api-backend/api/healthai/check");
    expect((await res.json()).error).toBe("free_quota_exceeded");
    expect(handler).toHaveBeenCalledTimes(1);
    const evt = handler.mock.calls[0][0] as CustomEvent<PaywallPayload>;
    expect(evt.detail.module).toBe("healthai");
    expect(evt.detail.upgradeUrl).toBe("https://aevion.app/pricing");
    window.removeEventListener(PAYWALL_EVENT, handler as EventListener);
  });

  it("КОНТРОЛЬ: 402 с чужим кодом окна не поднимает", async () => {
    window.fetch = vi.fn().mockResolvedValue(ответ(402, { error: "card_declined" }));
    installPaywallInterceptor();
    const handler = vi.fn();
    window.addEventListener(PAYWALL_EVENT, handler as EventListener);
    await window.fetch("/api-backend/api/qmaskcard/x");
    expect(handler).not.toHaveBeenCalled();
    window.removeEventListener(PAYWALL_EVENT, handler as EventListener);
  });
});
