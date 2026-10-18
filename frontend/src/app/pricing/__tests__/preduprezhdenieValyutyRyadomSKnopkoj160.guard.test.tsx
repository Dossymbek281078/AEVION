import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, act, waitFor, fireEvent, screen } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";

/*
 * 🔴 160 (18.10.2026, Продажи на проде a5751236, 1463×724). Смета в EUR, «Оплатить смету · €368» → касса считает
 * в USD; по правилу 31.08 первое нажатие не уводит, а предупреждает — но предупреждение рисовалось наверху страницы,
 * на 6 556 px выше кнопки: для человека «нажал — ничего не произошло». Теперь предупреждение, вызванное кнопкой
 * сметы, рисуется у этой кнопки ([data-calc-notice]), а верхний блок для него не показывается.
 * Контроль: в USD предупреждения нет и первое нажатие идёт в кассу (запрос сессии + переход по ссылке).
 */

type Запрос = { url: string; init?: RequestInit };

function сервер(валютаКассы: string, запросы: Запрос[]) {
  vi.stubGlobal("fetch", async (u: string, init?: RequestInit) => {
    const адрес = String(u);
    запросы.push({ url: адрес, init });
    if (адрес.includes("checkout/healthz")) {
      return { ok: true, status: 200, json: async () => ({ ok: true, providers: { paybox: { configured: false }, lemonsqueezy: { configured: true } } }) } as unknown as Response;
    }
    if (адрес.includes("/pricing/trust")) return { ok: true, status: 200, json: async () => ({ numbers: [], badges: [] }) } as unknown as Response;
    if (адрес.includes("/api/pricing/quote")) {
      const body = JSON.parse(String(init?.body ?? "{}")) as { tierId: string; currency: string };
      const total = body.currency === "EUR" ? 368 : 400;
      return { ok: true, status: 200, json: async () => ({ tierId: body.tierId, termMonths: 1, currency: body.currency, lines: [{ kind: "tier", label: "lite", unitPrice: total, qty: 1, total }], subtotal: total, discount: 0, total, notes: [], promo: null }) } as unknown as Response;
    }
    if (адрес.includes("/api/pricing/checkout/session")) {
      return { ok: true, status: 200, json: async () => ({ ok: true, url: "https://checkout.example/x", currency: валютаКассы, provider: "lemonsqueezy" }) } as unknown as Response;
    }
    return { ok: true, status: 200, json: async () => ({ currencies: { USD: { symbol: "$", rate: 1 }, KZT: { symbol: "₸", rate: 470 }, EUR: { symbol: "€", rate: 0.92 } }, tiers: [], modules: [], bundles: [], notes: [], items: [], runs: [] }) } as unknown as Response;
  });
}

async function открытьСмету(валютаЭкрана: "USD" | "EUR", валютаКассы: string) {
  const запросы: Запрос[] = [];
  сервер(валютаКассы, запросы);
  window.history.replaceState({}, "", "/pricing?tier=lite#calculator");
  const m = await import("@/app/pricing/page");
  const Страница = m.default as () => import("react").JSX.Element;
  await act(async () => { render(<I18nProvider><Страница /></I18nProvider>); });
  const кнопка = async () => {
    const все = await screen.findAllByRole("button");
    const b = все.find((x) => /Оплатить смету|Pay/i.test(x.textContent ?? ""));
    if (!b) throw new Error("кнопка оплаты сметы не найдена");
    return b;
  };
  await waitFor(async () => expect((await кнопка()).textContent).toMatch(/\d/), { timeout: 5000 });
  if (валютаЭкрана === "EUR") {
    const select = document.querySelector("select option[value='EUR']")?.parentElement as HTMLSelectElement;
    expect(select, "переключатель валюты").toBeTruthy();
    fireEvent.change(select, { target: { value: "EUR" } });
    await waitFor(async () => expect((await кнопка()).textContent).toContain("€"), { timeout: 5000 });
  }
  return { запросы, кнопка };
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState({}, "", "/"); });

describe("160: предупреждение о валюте кассы стоит у кнопки сметы", () => {
  it("🔴 EUR на экране, USD в кассе → первое нажатие показывает предупреждение У КНОПКИ, а не наверху; в кассу не уходим", async () => {
    const { запросы, кнопка } = await открытьСмету("EUR", "USD");
    const b = await кнопка();
    await act(async () => { fireEvent.click(b); });
    const уведомление = await waitFor(() => { const n = document.querySelector("[data-calc-notice]"); expect(n).toBeTruthy(); return n as HTMLElement; }, { timeout: 5000 });
    expect(уведомление.textContent ?? "").toMatch(/EUR/);
    expect(уведомление.textContent ?? "").toMatch(/USD/);
    // предупреждение одно — верхний блок для нажатия из сметы не показывается
    const текст = (уведомление.textContent ?? "").trim().slice(0, 30);
    const совпадения = Array.from(document.body.querySelectorAll("div")).filter((d) => (d.textContent ?? "").trim().startsWith(текст) && d.children.length <= 2);
    expect(совпадения.every((d) => d === уведомление || уведомление.contains(d) || d.contains(уведомление))).toBe(true);
    // кнопка сметы и предупреждение — соседи в одном блоке калькулятора
    expect(уведомление.closest("#calculator")).toBeTruthy();
    expect(запросы.filter((q) => q.url.includes("/checkout/session")).length).toBe(1);
  });

  it("КОНТРОЛЬ: USD на экране и в кассе → предупреждения нет, запрос сессии ушёл", async () => {
    const { запросы, кнопка } = await открытьСмету("USD", "USD");
    const b = await кнопка();
    await act(async () => { fireEvent.click(b); });
    await waitFor(() => expect(запросы.filter((q) => q.url.includes("/checkout/session")).length).toBe(1), { timeout: 5000 });
    expect(document.querySelector("[data-calc-notice]")).toBeNull();
  });
});
