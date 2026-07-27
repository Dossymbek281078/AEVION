import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { PAYWALL_EVENT } from "@/lib/paywall";
import { I18nProvider } from "@/lib/i18n";
import { PaywallModal } from "@/components/PaywallModal";

/**
 * 🔴 Стена 402 не обещает цену, которой не будет в счёте.
 *
 * Найдено вычиткой 2026-07-27: блок веера в стене печатал «$12.35 вместо $19»,
 * не спрашивая канал. А канал по умолчанию (LemonSqueezy) применяет нашу сумму
 * только при `LEMON_SQUEEZY_ALLOW_CUSTOM_PRICE=1`, которого нет. Заблокированный
 * пользователь видел скидку в стене, уходил платить и платил полную цену — то
 * самое «показали одно, спишут другое», ради которого сделана вся ветка, живьём
 * на самой конверсионной поверхности.
 *
 * У модалки не было ни одного теста, хотя она показывается на каждом отказе
 * пейвола. Держим обе половины: спишут — называем цену; не спишут — называем
 * скидку и канал, но цену НЕ называем.
 */

const PAYLOAD = {
  error: "upgrade_required" as const,
  module: "qcontract",
  plan: "free" as const,
  requiredTiers: ["medium" as const, "full" as const],
  upgradeUrl: "https://aevion.io/pricing",
  message: "Модуль «qcontract» доступен на тарифах: medium, full.",
};

const OFFER = { module: "qcontract", discountPercent: 35, priceMonthly: 12.35, listMonthly: 19 };

function mockFanMe(honouredByDefault: boolean) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (!url.includes("/fan/me")) return { ok: false, status: 404, json: async () => null } as Response;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        status: "active",
        validUntil: "2026-08-10T00:00:00.000Z",
        offers: [OFFER],
        discount: { honouredByDefault, honouredVia: honouredByDefault ? ["lemonsqueezy"] : ["paypal"] },
      }),
    } as Response;
  });
}

/**
 * Токен подменяем ИЗМЕНЯЕМОЙ переменной, а не `resetModules` + динамическим
 * импортом. Первая версия делала именно так и стала флакующей: перезагрузка
 * графа компонентов под общей нагрузкой не укладывалась в бюджет `waitFor`
 * (падение по таймауту 5 с, в одиночку — зелено). Причина устранена, а не
 * замаскирована увеличением таймаута.
 */
let token: string | null = "token-abc";
vi.mock("@/lib/aevionCatalog", () => ({ getAuthToken: () => token }));

async function openWall(honoured: boolean) {
  vi.stubGlobal("fetch", mockFanMe(honoured));
  render(
    <I18nProvider>
      <PaywallModal />
    </I18nProvider>,
  );
  await act(async () => {
    window.dispatchEvent(new CustomEvent(PAYWALL_EVENT, { detail: PAYLOAD }));
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  token = "token-abc";
});

describe("стена 402 — веерное предложение", () => {
  it("✅ скидку списывают — называем цену покупателя", async () => {
    await openWall(true);
    await waitFor(() => expect(screen.getByText(/12\.35/)).toBeTruthy());
    expect(screen.getByText(/−35%/)).toBeTruthy();
  });

  it("🔴 скидку НЕ списывают — цены в стене нет", async () => {
    await openWall(false);
    // Скидка названа…
    await waitFor(() => expect(screen.getByText(/35%/)).toBeTruthy());
    // …а цена, которой не будет в счёте, — нет.
    expect(screen.queryByText(/12\.35/)).toBeNull();
    expect(screen.getByText(/PayPal/i)).toBeTruthy();
  });

  it("сама стена показывается в обоих случаях — предложение её не заменяет", async () => {
    // Без этой проверки «нет цены» удовлетворялось бы и сломанной модалкой.
    await openWall(false);
    expect(await screen.findByText(/Доступно на платном тарифе/)).toBeTruthy();
  });
});
