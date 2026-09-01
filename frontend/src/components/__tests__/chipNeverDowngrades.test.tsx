import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import ModulePricingChip from "../ModulePricingChip";

/**
 * Кнопка «Купить» на странице модуля не понижает того, кто платит больше.
 *
 * Замер соседнего окна на сквозном стенде — настоящий вебхук, настоящий файл
 * подписок, настоящая функция стены:
 *
 *     купил medium              -> medium
 *     затем «докупил модуль»    -> LITE
 *
 * Для кассы «докупить модуль» и «перейти на Lite» — одно событие: ссылка
 * заказа собирается как `tier_<id>_<период>`. Кнопка жёстко оформляет
 * `tierId: "lite"` и стоит на 37 страницах модулей, ни разу не спрашивая, какой
 * тариф у человека. То есть покупатель платил ВТОРОЙ раз и получал МЕНЬШЕ.
 *
 * ⚠️ Границы правки названы честно: цену и состав пакетов не трогаем, это
 * решение основателя. Убран ровно вред — предложение, которое понижает.
 */

vi.mock("@/lib/track", () => ({ track: vi.fn() }));
vi.mock("@/lib/apiBase", () => ({ apiUrl: (p: string) => p }));

const TIERS = {
  tiers: [{ id: "lite", priceMonthly: 19 }, { id: "medium", priceMonthly: 49 }],
  currencies: {},
};

function mockPlan(plan: string | null) {
  globalThis.fetch = vi.fn(async (url: any) => {
    const u = String(url);
    if (u.includes("entitlements")) {
      return plan === null
        ? ({ ok: false, json: async () => ({}) } as Response)
        : ({ ok: true, json: async () => ({ plan }) } as Response);
    }
    return { ok: true, json: async () => TIERS } as Response;
  }) as unknown as typeof fetch;
}

describe("кнопка модуля не продаёт понижение", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("контроль: гостю кнопка «Купить» ПОКАЗЫВАЕТСЯ", async () => {
    // Без этой стороны правка выродилась бы в «спрятали кассу»: проверка,
    // требующая только отсутствия кнопки, зеленела бы и на пустом компоненте.
    mockPlan("free");
    render(<ModulePricingChip moduleId="qlearn" />);
    await waitFor(() => expect(screen.getByText("Купить")).toBeTruthy());
  });

  it("человеку без входа — тоже показывается: незнание не закрывает кассу", async () => {
    mockPlan(null);
    render(<ModulePricingChip moduleId="qlearn" />);
    await waitFor(() => expect(screen.getByText("Купить")).toBeTruthy());
  });

  it("у кого тариф ВЫШЕ Lite — кнопки «Купить» нет", async () => {
    mockPlan("medium");
    render(<ModulePricingChip moduleId="qlearn" />);
    await waitFor(() => expect(screen.getByText("Уже включено")).toBeTruthy());
    expect(
      screen.queryByText("Купить"),
      "человек уже платит за medium — эта кнопка оформила бы Lite и понизила его",
    ).toBeNull();
  });

  it("на самом Lite покупка остаётся: это не понижение", async () => {
    mockPlan("lite");
    render(<ModulePricingChip moduleId="qlearn" />);
    await waitFor(() => expect(screen.getByText("Купить")).toBeTruthy());
  });
});

/**
 * Кнопка заказывает ИМЕННО ТОТ тариф, цену которого показывает.
 *
 * Найдено мутационным свипом 01.09.2026: подмена `tierId: "lite"` на `"full"`
 * не ловилась НИ ОДНИМ тестом. То есть кнопка могла показывать «$19/мес» и
 * оформлять заказ на другой тариф, а мы бы узнали об этом из жалоб.
 *
 * Прежние проверки этого файла спрашивали, ПОКАЗЫВАЕТСЯ ли кнопка. Это другое
 * утверждение: механизм работает — не то же самое, что механизм делает верное.
 * Ровно тот класс, который соседнее окно нашло сегодня трижды на вебхуках.
 */
describe("кнопка заказывает тот тариф, что показывает", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("в кассу уходит lite — тот тариф, чью цену видит человек", async () => {
    mockPlan("free");
    render(<ModulePricingChip moduleId="qlearn" />);
    await waitFor(() => expect(screen.getByText("Купить")).toBeTruthy());
    screen.getByText("Купить").click();

    await waitFor(() => {
      const вызовы = (globalThis.fetch as any).mock.calls;
      const кассе = вызовы.find((c: any[]) => String(c[0]).includes("checkout/session"));
      expect(кассе, "запрос в кассу не ушёл").toBeTruthy();
      const тело = JSON.parse(кассе[1].body);
      expect(
        тело.tierId,
        "кнопка показывает цену Lite, а заказывает другой тариф",
      ).toBe("lite");
      expect(тело.modules, "модуль не доехал до кассы").toEqual(["qlearn"]);
    });
  });
});
