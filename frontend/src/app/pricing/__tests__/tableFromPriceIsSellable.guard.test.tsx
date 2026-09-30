import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";
import { STANDALONE_APPS, termPricePerMonth } from "@/lib/termPricing";

/**
 * КОЛОНКА «ОТДЕЛЬНО, ОТ / МЕС» НАЗЫВАЕТ ЦЕНУ ПРОДАВАЕМОГО СРОКА.
 *
 * 30.09.2026. В карточках приложений этот дефект уже починили, а соседняя
 * колонка той же страницы осталась: она показывала половинную цену Max у
 * QRight ($12), QSign ($12), биржи ($20) и QSkyway ($8) — им касса длинные
 * сроки не продаёт, отвечает 503. Нашли окна оркестратора и приёмки.
 *
 * Урок, ради которого написан этот сторож: я чинил ОДНУ поверхность и не
 * проверил соседнюю, где живёт то же число. Проверять новую цифру надо и там,
 * где она НЕ должна появиться.
 */

let ПРОДАЁТСЯ: string[] = [];

function ответыСервера() {
  vi.stubGlobal("fetch", async (u: string) => {
    const адрес = String(u);
    if (адрес.includes("checkout/healthz")) {
      return { ok: true, status: 200, json: async () => ({ ok: true, providers: { paybox: { configured: false }, lemonsqueezy: { configured: true, sellable: { configured: ПРОДАЁТСЯ, missing: [] } } } }) } as unknown as Response;
    }
    if (адрес.includes("/pricing/trust")) {
      return { ok: true, status: 200, json: async () => ({ numbers: [], badges: [] }) } as unknown as Response;
    }
    return { ok: true, status: 200, json: async () => ({
      currencies: { USD: { symbol: "$", rate: 1 }, KZT: { symbol: "₸", rate: 470 }, EUR: { symbol: "€", rate: 0.92 } },
      tiers: [],
      // Форма модуля взята из настоящей фикстуры (__fixtures__/pricing.json):
      // страница читает includedIn, tags и прочее БЕЗ защиты, и выдуманная
      // строка роняла отрисовку — «Cannot read properties of undefined».
      modules: [{
        id: "qright",
        name: "QRight",
        code: "QRIGHT",
        kind: "module",
        oneLiner: "Регистрация цифровых объектов",
        availability: "live",
        addonMonthly: 0,
        includedIn: ["lite", "medium", "pro", "full", "max", "enterprise"],
        tags: ["ip"],
      }],
      bundles: [], notes: [], items: [], runs: [],
    }) } as unknown as Response;
  });
}

async function текстСтраницы() {
  const m = await import("@/app/pricing/page");
  const Страница = m.default as () => import("react").JSX.Element;
  await act(async () => {
    render(
      <I18nProvider>
        <Страница />
      </I18nProvider>,
    );
  });
  return document.body.textContent ?? "";
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("колонка «Отдельно, от / мес»", () => {
  it("продаётся только месяц — «от» это цена месяца, а не половина Max", async () => {
    ПРОДАЁТСЯ = ["app_qright_lite"];
    ответыСервера();
    const текст = await текстСтраницы();
    const qright = STANDALONE_APPS.find((a) => a.slug === "qright")!;
    const заМесяц = termPricePerMonth(qright.baseMonthly, "lite");
    const заГод = termPricePerMonth(qright.baseMonthly, "max");
    expect(заГод, "границы совпали — проверка ничего не значит").toBeLessThan(заМесяц);
    expect(текст.includes(String(заМесяц)), `в таблице нет цены месяца ${заМесяц}`).toBe(true);
    expect(
      текст.includes(`$${заГод}`),
      `обещана цена ${заГод} за срок, который касса не продаёт`,
    ).toBe(false);
  }, 120000);

  it("продаются все сроки — «от» это самый дешёвый", async () => {
    ПРОДАЁТСЯ = ["app_qright_lite", "app_qright_medium", "app_qright_pro", "app_qright_full", "app_qright_max"];
    ответыСервера();
    const текст = await текстСтраницы();
    const qright = STANDALONE_APPS.find((a) => a.slug === "qright")!;
    expect(текст.includes(`$${termPricePerMonth(qright.baseMonthly, "max")}`)).toBe(true);
  }, 120000);
});

describe("список продаваемого не пришёл", () => {
  it("показываем цену месяца, а не самого длинного срока", async () => {
    // Незнание не вправе обещать скидку: цена месяца заведомо не ниже
    // настоящей, и человек не увидит числа, которого может не быть.
    vi.stubGlobal("fetch", async (u: string) => {
      const адрес = String(u);
      if (адрес.includes("checkout/healthz")) {
        return { ok: false, status: 503, json: async () => ({}) } as unknown as Response;
      }
      if (адрес.includes("/pricing/trust")) {
        return { ok: true, status: 200, json: async () => ({ numbers: [], badges: [] }) } as unknown as Response;
      }
      return { ok: true, status: 200, json: async () => ({
        currencies: { USD: { symbol: "$", rate: 1 }, KZT: { symbol: "₸", rate: 470 }, EUR: { symbol: "€", rate: 0.92 } },
        tiers: [],
        modules: [{
          id: "qright", name: "QRight", code: "QRIGHT", kind: "module",
          oneLiner: "Регистрация цифровых объектов", availability: "live",
          addonMonthly: 0, includedIn: ["lite", "max"], tags: ["ip"],
        }],
        bundles: [], notes: [], items: [], runs: [],
      }) } as unknown as Response;
    });
    const текст = await текстСтраницы();
    const qright = STANDALONE_APPS.find((a) => a.slug === "qright")!;
    expect(текст.includes(String(termPricePerMonth(qright.baseMonthly, "lite"))), "цены месяца нет").toBe(true);
    expect(
      текст.includes(`$${termPricePerMonth(qright.baseMonthly, "max")}`),
      "список не пришёл, а цена длинного срока обещана",
    ).toBe(false);
  }, 120000);
});
