import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";
import ModulePricingChip from "@/components/ModulePricingChip";

/**
 * У чипа не было ни одного теста, хотя он висит на 37 страницах модулей и в него
 * добавлены две новые вещи: строка веера и CTA «цена по запросу» для модулей без
 * à-la-carte цены. Обе тихие: если сломаются, чип просто перестанет их
 * показывать — ошибки не будет, потери — будут.
 *
 * Правило, которое сторожит файл: пустого обещания быть не должно. У
 * модуля-одиночки (веер ничего не открывает) строки нет вовсе — «веер 0» хуже
 * молчания.
 */

const PRICING = {
  tiers: [
    { id: "lite", name: "Lite", priceMonthly: 24 },
    { id: "medium", name: "Medium", priceMonthly: 39 },
    { id: "full", name: "Full", priceMonthly: 89 },
  ],
  modules: [
    { id: "qcontract", addonMonthly: 19, availability: "beta" },
    { id: "lifebox", addonMonthly: 9, availability: "beta" },
    { id: "qskyway", addonMonthly: null, availability: "beta" },
  ],
  currencies: { USD: { rate: 1, symbol: "$", label: "USD" } },
};

const FAN_PREVIEW = {
  items: [
    { module: "qcontract", listMonthly: 19, ring1: ["qsign", "qright", "aevion-ip-bureau"], ring2Count: 1, ring3Count: 20, ring1SavingMonthly: 11.1 },
    { module: "lifebox", listMonthly: 9, ring1: [], ring2Count: 0, ring3Count: 25, ring1SavingMonthly: 0 },
  ],
  total: 2,
};

function mockFetch() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const body = url.includes("/fan/preview") ? FAN_PREVIEW : PRICING;
    return { ok: true, status: 200, json: async () => body } as Response;
  });
}

function renderChip(moduleId: string) {
  return render(
    <I18nProvider>
      <ModulePricingChip moduleId={moduleId} currency="USD" />
    </I18nProvider>,
  );
}

afterEach(() => vi.restoreAllMocks());

describe("ModulePricingChip — веер и цена по запросу", () => {
  it("показывает, сколько модулей подешевеет, если купить этот", async () => {
    vi.stubGlobal("fetch", mockFetch());
    renderChip("qcontract");
    await waitFor(() => expect(screen.getByText(/fan: 3 modules cheaper/i)).toBeTruthy());
    expect(screen.getByText(/\$11\.1/)).toBeTruthy();
  });

  it("🔴 у модуля-одиночки строки веера НЕТ — пустое обещание хуже молчания", async () => {
    vi.stubGlobal("fetch", mockFetch());
    renderChip("lifebox");
    // Цена появилась, значит чип отрисовался и данные пришли…
    await waitFor(() => expect(screen.getByText(/Lite/)).toBeTruthy());
    // …а веера нет.
    expect(screen.queryByText(/modules cheaper/i)).toBeNull();
  });

  it("модуль без à-la-carte цены ведёт на запрос цены, а не молчит", async () => {
    vi.stubGlobal("fetch", mockFetch());
    renderChip("qskyway");
    const link = await waitFor(() => screen.getByText(/price on request/i));
    expect(link.closest("a")?.getAttribute("href")).toBe("/pricing/contact?module=qskyway");
  });
});

/**
 * 🔴 Разовый сбой сети не должен выключать чип навсегда.
 *
 * Найдено вычиткой дифа 2026-07-27: кэш клал промис в память ДО того, как тот
 * разрешится, и неудача оставалась в нём на всю жизнь страницы. Один холодный
 * старт бэкенда — и веерная строка не появлялась уже никогда, а у /api/pricing
 * пропадала и сама цена; перерисовка не помогала, помогала только перезагрузка
 * вкладки. Тот же тупик уже чинился в FanDiscountPanel — здесь он остался.
 *
 * Модуль импортируется заново (`resetModules`), иначе тест унаследует успешный
 * кэш от тестов выше и ничего не проверит.
 */
describe("кэш чипа не запоминает сбой навсегда", () => {
  it("после неудачного запроса следующий рендер пробует снова", async () => {
    // Фейковые таймеры — С САМОГО НАЧАЛА. Кулдаун ставится setTimeout'ом в
    // момент неудачи; если подменить таймеры ПОСЛЕ неё, этот таймер останется
    // настоящим, и промотка времени его не тронет (проверено — тест падал).
    vi.useFakeTimers();
    vi.resetModules();
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        calls += 1;
        if (calls <= 2) throw new Error("network down"); // первый заход по каждому адресу падает
        return { ok: true, status: 200, json: async () => (url.includes("/fan/preview") ? FAN_PREVIEW : PRICING) } as Response;
      }),
    );
    // Провайдер тоже из свежего графа: после resetModules старый I18nProvider
    // держит ДРУГОЙ объект контекста, и свежий чип его не видит.
    const Fresh = (await import("@/components/ModulePricingChip")).default;
    const { I18nProvider: FreshProvider } = await import("@/lib/i18n");

    const first = render(
      <FreshProvider>
        <Fresh moduleId="qcontract" currency="USD" />
      </FreshProvider>,
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(calls, "первый рендер должен сходить за прайсом и за веером").toBe(2);
    first.unmount();

    // Кулдаун ещё идёт — сеть не дёргаем повторно.
    const second = render(
      <FreshProvider>
        <Fresh moduleId="qcontract" currency="USD" />
      </FreshProvider>,
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(calls, "в кулдаун повторных запросов быть не должно").toBe(2);
    second.unmount();

    // Кулдаун истёк — новый рендер обязан сходить снова и показать веер.
    await vi.advanceTimersByTimeAsync(31_000);
    render(
      <FreshProvider>
        <Fresh moduleId="qcontract" currency="USD" />
      </FreshProvider>,
    );
    await vi.advanceTimersByTimeAsync(0);
    // Точное число вызовов хрупко (два независимых кэша + перерисовки), поэтому
    // проверяем сам факт: после кулдауна в сеть снова сходили.
    expect(calls, "после кулдауна запрос должен повториться").toBeGreaterThan(2);
    vi.useRealTimers();
    await waitFor(() => expect(screen.getByText(/fan: 3 modules cheaper/i)).toBeTruthy());
  });
});
