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

/**
 * Фикстура повторяет ЖИВОЙ ответ /api/me/entitlements, а не удобную выдумку:
 * { plan, email, reason, modules: [{ module, requiredTiers, entitled }] }.
 *
 * Прежняя подавала только { plan } — и сторож был слеп к целому вопросу:
 * «а есть ли у человека доступ УЖЕ». Подписчик Lite, которому модуль открыт,
 * видел «Купить Lite» — предложение купить то, что у него есть. Тариф и карта
 * доступа отвечают на РАЗНЫЕ вопросы, и второй мы не задавали.
 */
function mockPlanWithModules(plan: string | null, ужеЕсть: boolean, moduleId: string) {
  const original = globalThis.fetch;
  globalThis.fetch = (async (u: string) => {
    if (String(u).includes("entitlements")) {
      if (plan === null) return { ok: false, json: async () => ({}) } as Response;
      return {
        ok: true,
        json: async () => ({
          plan,
          email: null,
          reason: "test",
          modules: [{ module: moduleId, requiredTiers: ["lite"], entitled: ужеЕсть }],
        }),
      } as Response;
    }
    return original ? original(u as never) : ({ ok: false, json: async () => ({}) } as Response);
  }) as typeof fetch;
  return () => { globalThis.fetch = original; };
}

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
describe("не продаём то, что уже есть", () => {
  it("подписчику, которому модуль УЖЕ открыт, кнопки «Купить» нет", async () => {
    const restore = mockPlanWithModules("lite", true, "qlearn");
    try {
      render(<ModulePricingChip moduleId="qlearn" />);
      // Ждём ПОЛОЖИТЕЛЬНОГО признака, а не отсутствия кнопки.
      // Первая редакция ждала «кнопки нет» — и это условие выполняется само
      // собой, пока чип ещё грузит цены и права. Мутация «снять проверку
      // доступа» её НЕ уронила: тест был зелен на сломанном коде.
      // Сначала дожидаемся замены («Уже включено» рисуется только когда покупка
      // не нужна), и лишь потом утверждаем, что кнопки нет.
      await waitFor(() => {
        expect(
          screen.queryByText(/Уже включено/i),
          "замена кнопки не появилась — значит права ещё не применены",
        ).not.toBeNull();
      });
      expect(
        screen.queryByRole("button", { name: /Купить/i }),
        "предлагаем купить доступ, который у человека уже есть",
      ).toBeNull();
    } finally {
      restore();
    }
  });

  it("контроль: тому же тарифу БЕЗ доступа кнопка показывается", async () => {
    const restore = mockPlanWithModules("lite", false, "qlearn");
    try {
      render(<ModulePricingChip moduleId="qlearn" />);
      await waitFor(() => {
        expect(
          screen.queryByRole("button", { name: /Купить/i }),
          "контроль: кнопка пропала и без доступа — значит проверка меряет не то",
        ).not.toBeNull();
      });
    } finally {
      restore();
    }
  });
});

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
