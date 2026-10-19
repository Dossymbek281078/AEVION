import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, act, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { I18nProvider } from "@/lib/i18n";
import { TERM_MONTHS, PLANET_BASE_MONTHLY, termTotal, type TermTier , planetTotal } from "@/lib/termPricing";
import { тарифИзАдреса } from "../tarifIzAdresa";

/*
 * 🔴 154 (18.10.2026). Тариф, выбранный на /pricing/<tier>, обязан доехать до сметы.
 *
 * Продажи 18.10, прод f857f941, Playwright: /pricing/lite → «Выбрать Lite» → /pricing#calculator, в смете
 * «Medium — 3 месяца, $1 050»; контроль с /pricing/max — та же смета. Lite-покупателю цена завышена в 2,6 раза
 * (за 14 дней 6 начатых оплат, 0 покупок), Max-покупатель заплатил бы $1 050 вместо $2 400.
 *
 * Здесь ПОВЕДЕНИЕ: страница /pricing?tier=<id> монтируется, и ПЕРВЫЙ запрос сметы в /api/pricing/quote несёт
 * tierId = <id>; ответ ручки (мок с настоящими ценами по сроку) показывается человеку. Пиксели и касса — браузером
 * на проде. Касса намеренно не открывается до «оплатить».
 */

const СТРАНИЦА_ТАРИФА = readFileSync(join(__dirname, "..", "[tierId]", "page.tsx"), "utf8");

type Запрос = { url: string; body: Record<string, unknown> };

function ответыСервера(запросыСметы: Запрос[]) {
  vi.stubGlobal("fetch", async (u: string, init?: RequestInit) => {
    const адрес = String(u);
    if (адрес.includes("checkout/healthz")) {
      const h = { ok: true, providers: { paybox: { configured: false }, lemonsqueezy: { configured: true } } };
      return { ok: true, status: 200, json: async () => h } as unknown as Response;
    }
    if (адрес.includes("/pricing/trust")) {
      return { ok: true, status: 200, json: async () => ({ numbers: [], badges: [] }) } as unknown as Response;
    }
    if (адрес.includes("/api/pricing/quote")) {
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      запросыСметы.push({ url: адрес, body });
      const tier = String(body.tierId) as TermTier;
      const months = TERM_MONTHS[tier] ?? null;
      const total = months ? planetTotal(tier) : 0;
      const смета = {
        tierId: tier, termMonths: months, currency: "USD",
        lines: [{ kind: "tier", label: tier, unitPrice: total, qty: 1, total }],
        subtotal: total, discount: 0, total, notes: [], promo: null,
      };
      return { ok: true, status: 200, json: async () => смета } as unknown as Response;
    }
    const тело = {
      currencies: { USD: { symbol: "$", rate: 1 }, KZT: { symbol: "₸", rate: 470 }, EUR: { symbol: "€", rate: 0.92 } },
      tiers: [], modules: [], bundles: [], notes: [], items: [], runs: [],
    };
    return { ok: true, status: 200, json: async () => тело } as unknown as Response;
  });
}

async function открыть(адрес: string): Promise<Запрос[]> {
  const запросы: Запрос[] = [];
  ответыСервера(запросы);
  window.history.replaceState({}, "", адрес);
  const m = await import("@/app/pricing/page");
  const Страница = m.default as () => import("react").JSX.Element;
  await act(async () => {
    render(<I18nProvider><Страница /></I18nProvider>);
  });
  await waitFor(() => expect(запросы.length).toBeGreaterThan(0), { timeout: 4000 });
  // ждём, пока ответ сметы дойдёт до экрана
  await waitFor(() => expect(document.body.textContent ?? "").toMatch(/\$\s?\d/), { timeout: 4000 });
  return запросы;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
});

describe("154: тариф со страницы тарифа доезжает до сметы", () => {
  it.each([
    ["lite", 250, 1],
    ["medium", 675, 3],
    ["pro", 1200, 6],
    ["max", 1800, 12],
  ] as const)("🔴 /pricing?tier=%s → смета этого тарифа: $%i за %i мес.", async (tier, total, months) => {
    expect(planetTotal(tier), "контроль: цена из termPricing").toBe(total);
    const запросы = await открыть(`/pricing?tier=${tier}#calculator`);
    const последний = запросы[запросы.length - 1];
    expect(последний.body.tierId).toBe(tier);
    expect(запросы.every((q) => q.body.tierId === tier), `смета спрашивалась и за чужой тариф: ${JSON.stringify(запросы.map((q) => q.body.tierId))}`).toBe(true);
    const текст = (document.body.textContent ?? "").replace(/ /g, " ");
    expect(текст).toContain(`$${total.toLocaleString("ru-RU").replace(/ /g, " ")}`);
    expect(TERM_MONTHS[tier]).toBe(months);
  });

  it("КОНТРОЛЬ: без параметра и с незнакомым значением смета остаётся Medium", async () => {
    const без = await открыть("/pricing#calculator");
    expect(без[без.length - 1].body.tierId).toBe("medium");
    cleanup(); vi.unstubAllGlobals();
    const чужое = await открыть("/pricing?tier=platinum#calculator");
    expect(чужое[чужое.length - 1].body.tierId).toBe("medium");
  });

  it("тарифИзАдреса: пять тарифов по сроку узнаются, мусор и free/enterprise — нет", () => {
    for (const t of ["lite", "medium", "pro", "full", "max"]) expect(тарифИзАдреса(t)).toBe(t);
    expect(тарифИзАдреса(" MAX ")).toBe("max");
    for (const t of ["", null, undefined, "platinum", "free", "enterprise", "lite;drop"]) expect(тарифИзАдреса(t)).toBeNull();
  });

  it("🔴 обе кнопки страницы тарифа ведут в калькулятор С тарифом, без тарифа — ни одна", () => {
    const сТарифом = СТРАНИЦА_ТАРИФА.split("router.push(`/pricing?tier=${tierId}#calculator`)").length - 1;
    expect(сТарифом).toBe(2);
    expect(СТРАНИЦА_ТАРИФА).not.toMatch(/router\.push\((["'`])\/pricing#calculator\1\)/);
  });
});
