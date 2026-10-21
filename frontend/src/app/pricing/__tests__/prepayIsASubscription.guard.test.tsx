import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, act, waitFor } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";
import { translations } from "@/lib/i18n-all";
import { TERM_TIERS, TERM_MONTHS, TERM_NAME, PLANET_TERM_PRICE, planetTotal, planetPrepayTotal } from "@/lib/termPricing";

/**
 * «Весь срок вперёд» — это ПОДПИСКА, и карточка обязана так и сказать.
 *
 * Повод 21.10.2026 (замер окна Приложения, касса LS по 12 кнопкам /pricing, [Точно]):
 * у кнопок «вперёд» касса берёт итог со скидкой (641,25 $) и оформляет подписку
 * «billed every 3/6/9/12 months», а карточка обещала «одним платежом» и молчала про
 * продление. По коду (planetCheckoutVariant) в кассу уходит custom_price = этот итог —
 * по докам LS продление списывает именно его. Серая строка кассы ($675…) — цена
 * базового варианта; её убирает только свой вариант в кабинете LS (рука основателя).
 *
 * Сторожим: (1) нигде в словарях нет «одним платежом / in one payment / бір төлеммен»;
 * (2) у карточки, страницы срока и калькулятора рядом с «вперёд» стоит строка продления
 * с той же суммой и тем же числом месяцев, что уходит в кассу.
 */

const ОДИН_ПЛАТЁЖ = /одним платежом|in one payment|бір төлеммен/i;

const ПРАЙС = TERM_TIERS.map((id) => ({
  id, name: TERM_NAME[id], tagline: "", priceMonthly: PLANET_TERM_PRICE[id], termMonths: TERM_MONTHS[id],
  priceTermTotal: planetTotal(id), pricePrepayTotal: planetPrepayTotal(id), features: [],
  limits: { modules: null, qrightObjectsPerMonth: null, qsignOpsPerDay: null, llmTokensPerMonth: null, seats: null, supportSlaHours: null },
  ctaLabel: `Выбрать ${TERM_NAME[id]}`,
}));

function ответыСервера() {
  vi.stubGlobal("fetch", async (u: string) => {
    const адрес = String(u);
    if (адрес.includes("checkout/healthz")) {
      const h = { ok: true, providers: { paybox: { configured: false }, lemonsqueezy: { configured: true, sellable: { configured: TERM_TIERS.map((t) => `tier_${t}`), missing: [] } } } };
      return { ok: true, status: 200, json: async () => h } as unknown as Response;
    }
    if (адрес.includes("/api/pricing/quote")) {
      const q = { tierId: "medium", termMonths: 3, currency: "USD", lines: [{ kind: "tier", label: "План", unitPrice: 225, qty: 3, total: 675 }], subtotal: 675, discount: 0, total: 675, notes: [], promo: null, billing: "monthly", monthlyCharge: 225, prepayTotal: 641.25, prepayDiscountPercent: 5 };
      return { ok: true, status: 200, json: async () => q } as unknown as Response;
    }
    if (адрес.includes("/pricing/trust")) return { ok: true, status: 200, json: async () => ({ numbers: [], badges: [] }) } as unknown as Response;
    const тело = {
      currencies: { USD: { symbol: "$", rate: 1 }, KZT: { symbol: "₸", rate: 470 }, EUR: { symbol: "€", rate: 0.92 } },
      tiers: ПРАЙС, modules: [], bundles: [], notes: [], items: [], runs: [],
      plan: { id: "planet", billing: "monthly", terms: TERM_TIERS.map((t) => ({ tierId: t, months: TERM_MONTHS[t], perMonthUsd: PLANET_TERM_PRICE[t], totalUsd: planetTotal(t), prepayUsd: planetPrepayTotal(t), sellable: { monthly: true, prepaid: t !== "lite" } })) },
    };
    return { ok: true, status: 200, json: async () => тело } as unknown as Response;
  });
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("оплата вперёд — подписка с продлением, а не «один платёж»", () => {
  it("КОНТРОЛЬ прибора: запрет ловит прежние фразы на трёх языках", () => {
    expect(ОДИН_ПЛАТЁЖ.test("Или весь срок вперёд одним платежом: $641.25")).toBe(true);
    expect(ОДИН_ПЛАТЁЖ.test("pay the whole term up front in one payment at a discount")).toBe(true);
    expect(ОДИН_ПЛАТЁЖ.test("бүкіл мерзімді бір төлеммен алдын ала")).toBe(true);
  });

  it("словари ru/en/kk: ни одно значение не обещает «один платёж»", () => {
    const находки: string[] = [];
    let всего = 0;
    for (const lang of ["ru", "en", "kk"] as const) {
      for (const [k, v] of Object.entries(translations[lang] as Record<string, string>)) {
        всего++;
        if (ОДИН_ПЛАТЁЖ.test(v)) находки.push(`${lang} ${k}`);
      }
    }
    expect(всего, "прибор не видит словарей").toBeGreaterThan(20_000);
    expect(находки).toEqual([]);
  });

  it("строка продления есть на трёх языках, с суммой, сроком и отменой", () => {
    const отмена = { ru: /отмен/, en: /cancel/, kk: /бас тарт/ };
    for (const lang of ["ru", "en", "kk"] as const) {
      const v = (translations[lang] as Record<string, string>)["pricing.home.tier.prepayRenews"];
      expect(v, lang).toBeTruthy();
      for (const ph of ["{total}", "{months}", "{unit}"]) expect(v, `${lang} ${ph}`).toContain(ph);
      expect(v, lang).toMatch(отмена[lang]);
      expect(v, lang).toMatch(/Lemon Squeezy/);
    }
  });

  it("карточки и калькулятор /pricing: рядом с «вперёд» — сумма кассы и интервал продления", async () => {
    ответыСервера();
    const m = await import("@/app/pricing/page");
    const Страница = m.default as () => import("react").JSX.Element;
    await act(async () => { render(<I18nProvider><Страница /></I18nProvider>); });
    await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
    const текст = (sel: string) => (document.querySelector(sel)?.textContent ?? "").replace(/\s/g, " ");
    for (const t of TERM_TIERS.filter((x) => x !== "lite")) {
      const строка = текст(`[data-testid="renewal-${t}"]`);
      expect(строка, `${t}: строки продления нет`).not.toBe("");
      expect(строка, t).toContain(String(TERM_MONTHS[t]));
    }
    expect(текст('[data-testid="renewal-medium"]')).toContain("$641.25");
    expect(текст('[data-testid="renewal-max"]')).toContain("$1 575");
    expect(document.querySelector('[data-testid="renewal-lite"]'), "у месяца без срока «вперёд» нет").toBeNull();
    expect(document.body.textContent ?? "").not.toMatch(ОДИН_ПЛАТЁЖ);
    await waitFor(() => expect(document.querySelector('[data-testid="calc-renewal"]')).not.toBeNull(), { timeout: 4000 });
    expect(текст('[data-testid="calc-renewal"]')).toContain("$641.25");
    expect(текст('[data-testid="calc-renewal"]')).toMatch(/3 \S+.*(отмен|cancel|бас тарт)/);
  });
});
