import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, act, waitFor } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";
import { TERM_TIERS, TERM_MONTHS, TERM_NAME, PLANET_TERM_PRICE, planetTotal, planetPrepayTotal } from "@/lib/termPricing";

/**
 * 🔴 19.10.2026, вариант «Б»: кнопка «Оплатить весь срок вперёд» рисуется ТОЛЬКО когда
 * /api/pricing говорит plan.terms[].sellable.prepaid = true (вариант срока в кассе
 * задан). Без признака нажатие вело бы в 503 — кнопки быть не должно. Помесячная
 * кнопка держится на sellable.monthly (вариант tier_lite), а не на варианте срока.
 */

const ПРАЙС = TERM_TIERS.map((id) => ({
  id, name: TERM_NAME[id], tagline: "", priceMonthly: PLANET_TERM_PRICE[id], termMonths: TERM_MONTHS[id],
  priceTermTotal: planetTotal(id), pricePrepayTotal: planetPrepayTotal(id), features: [],
  limits: { modules: null, qrightObjectsPerMonth: null, qsignOpsPerDay: null, llmTokensPerMonth: null, seats: null, supportSlaHours: null },
  ctaLabel: `Выбрать ${TERM_NAME[id]}`,
}));

function ответыСервера(sellable: Record<string, { monthly: boolean; prepaid: boolean }> | null) {
  vi.stubGlobal("fetch", async (u: string) => {
    const адрес = String(u);
    if (адрес.includes("checkout/healthz")) {
      const h = { ok: true, providers: { paybox: { configured: false }, lemonsqueezy: { configured: true, sellable: { configured: TERM_TIERS.map((t) => `tier_${t}`), missing: [] } } } };
      return { ok: true, status: 200, json: async () => h } as unknown as Response;
    }
    if (адрес.includes("/api/pricing/quote")) {
      // Смета калькулятора — как /api/pricing/quote бэка (сторож бэка держит числа).
      const q = { tierId: "medium", termMonths: 3, currency: "USD", lines: [{ kind: "tier", label: "План", unitPrice: 225, qty: 3, total: 675 }], subtotal: 675, discount: 0, total: 675, notes: [], promo: null, billing: "monthly", monthlyCharge: 225, prepayTotal: 641.25, prepayDiscountPercent: 5 };
      return { ok: true, status: 200, json: async () => q } as unknown as Response;
    }
    if (адрес.includes("/pricing/trust")) return { ok: true, status: 200, json: async () => ({ numbers: [], badges: [] }) } as unknown as Response;
    const тело = {
      currencies: { USD: { symbol: "$", rate: 1 }, KZT: { symbol: "₸", rate: 470 }, EUR: { symbol: "€", rate: 0.92 } },
      tiers: ПРАЙС, modules: [], bundles: [], notes: [], items: [], runs: [],
      plan: { id: "planet", billing: "monthly", terms: TERM_TIERS.map((t) => ({ tierId: t, months: TERM_MONTHS[t], perMonthUsd: PLANET_TERM_PRICE[t], totalUsd: planetTotal(t), prepayUsd: planetPrepayTotal(t), ...(sellable ? { sellable: sellable[t] } : {}) })) },
    };
    return { ok: true, status: 200, json: async () => тело } as unknown as Response;
  });
}

async function отрисовать() {
  const m = await import("@/app/pricing/page");
  const Страница = m.default as () => import("react").JSX.Element;
  await act(async () => { render(<I18nProvider><Страница /></I18nProvider>); });
  await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("кнопка «весь срок вперёд» — только при продаваемом варианте срока", () => {
  it("все четыре срока продаются вперёд → четыре кнопки с суммой со скидкой; у месяца без срока кнопки нет", async () => {
    ответыСервера(Object.fromEntries(TERM_TIERS.map((t) => [t, { monthly: true, prepaid: t !== "lite" }])));
    await отрисовать();
    const кнопки = TERM_TIERS.map((t) => document.querySelector(`[data-testid="prepay-${t}"]`));
    expect(кнопки.map(Boolean)).toEqual([false, true, true, true, true]);
    expect(document.querySelector('[data-testid="prepay-max"]')?.textContent).toContain("1");
    expect(document.querySelector('[data-testid="prepay-max"]')?.textContent).toContain("575");
  });
  it("🔴 вариант срока не задан (prepaid=false у pro) → у pro кнопки нет, у остальных есть", async () => {
    ответыСервера(Object.fromEntries(TERM_TIERS.map((t) => [t, { monthly: true, prepaid: t !== "lite" && t !== "pro" }])));
    await отрисовать();
    expect(document.querySelector('[data-testid="prepay-pro"]')).toBeNull();
    expect(document.querySelector('[data-testid="prepay-medium"]')).not.toBeNull();
  });
  it("старый бэкенд без plan.terms[].sellable → кнопок «вперёд» нет вовсе, помесячная кнопка живая", async () => {
    ответыСервера(null);
    await отрисовать();
    expect(document.querySelectorAll('[data-testid^="prepay-"]').length).toBe(0);
    const помесячная = document.querySelector('[data-testid="billing-medium"]');
    expect(помесячная, "строка помесячного списания у срока 3 мес").not.toBeNull();
  });
  it("🔴 калькулятор: кнопка «помесячно» называет платёж месяца, «вперёд» — скидочную сумму; без варианта срока второй кнопки нет", async () => {
    ответыСервера(Object.fromEntries(TERM_TIERS.map((t) => [t, { monthly: true, prepaid: t !== "lite" }])));
    await отрисовать();
    // Смета приходит отдельным запросом после прайса — ждём кнопку, а не спим.
    await waitFor(() => expect(document.querySelector('[data-testid="calc-pay-monthly"]'), "кнопка помесячно").not.toBeNull(), { timeout: 4000 });
    const помесячно = document.querySelector('[data-testid="calc-pay-monthly"]');
    expect(помесячно?.textContent, "кнопка помесячно").toContain("225");
    expect(помесячно?.textContent).not.toContain("675");
    expect(document.querySelector('[data-testid="calc-billing"]')?.textContent).toContain("225");
    expect(document.querySelector('[data-testid="calc-pay-prepaid"]')?.textContent).toContain("641");
    cleanup(); vi.unstubAllGlobals();
    ответыСервера(Object.fromEntries(TERM_TIERS.map((t) => [t, { monthly: true, prepaid: false }])));
    await отрисовать();
    await waitFor(() => expect(document.querySelector('[data-testid="calc-pay-monthly"]')).not.toBeNull(), { timeout: 4000 });
    expect(document.querySelector('[data-testid="calc-pay-prepaid"]')).toBeNull();
  });
  it("КОНТРОЛЬ прибора: с prepaid=true везде кнопок четыре, не ноль", async () => {
    ответыСервера(Object.fromEntries(TERM_TIERS.map((t) => [t, { monthly: true, prepaid: true }])));
    await отрисовать();
    expect(document.querySelectorAll('[data-testid^="prepay-"]').length).toBe(4);
  });
});
