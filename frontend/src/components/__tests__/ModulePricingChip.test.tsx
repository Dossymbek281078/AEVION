/**
 * Плашка цены на странице модуля называет цены ЛЕСТНИЦЫ СРОКОВ (политика
 * 15.09.2026) и ведёт туда, где их можно оплатить.
 *
 * До 15.09 плашка читала /api/pricing и показывала помесячные тарифы
 * Lite/Medium/Full — этих тарифов больше нет. Теперь:
 *   · одно из пяти приложений → «от $X/мес», «<имя> отдельно», «вся планета от $200/мес»;
 *   · любой другой модуль     → «Входит в подписку AEVION · от $200/мес».
 * Числа — из @/lib/termPricing; снятые цены на плашке появиться не должны.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import ModulePricingChip from "../ModulePricingChip";
import { PLANET_BASE_MONTHLY, STANDALONE_APPS, TERM_TIERS, fromPricePerMonth, termPricePerMonth } from "@/lib/termPricing";

vi.mock("@/lib/apiBase", () => ({ apiUrl: (p: string) => p }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function guest() {
  globalThis.fetch = vi.fn(async () => ({ ok: false, json: async () => ({}) })) as unknown as typeof fetch;
}

/**
 * Гость, которому касса ОТВЕТИЛА списком продаваемых ссылок.
 * Нужен потому, что «от $X» обязано называть цену, которую можно заплатить:
 * у четырёх приложений длинные сроки в кассе не заведены (28.09.2026).
 */
function гостьСоСписком(ссылки: string[]) {
  globalThis.fetch = vi.fn(async (u: unknown) => {
    const адрес = String(u);
    if (адрес.includes("checkout/healthz")) {
      return {
        ok: true,
        json: async () => ({ providers: { lemonsqueezy: { sellable: { configured: ссылки } } } }),
      };
    }
    return { ok: false, json: async () => ({}) };
  }) as unknown as typeof fetch;
}

describe("ModulePricingChip — цены лестницы сроков", () => {
  it.each(STANDALONE_APPS.map((a) => [a.moduleId, a] as const))(
    "приложение %s: своя цена «от», имя и цена всей планеты",
    (moduleId, app) => {
      guest();
      const { container } = render(<ModulePricingChip moduleId={moduleId} />);
      const text = container.textContent ?? "";
      // Список не пришёл (guest) — называем цену МЕСЯЦА, а не самого
      // длинного срока: незнание не имеет права обещать скидку.
      expect(text).toContain(`$${termPricePerMonth(app.baseMonthly, "lite")}`);
      expect(text).toContain(app.name);
      expect(text).toContain(`от $${fromPricePerMonth(PLANET_BASE_MONTHLY)}/мес`);
      const buy = screen.getByText("Купить").closest("a")!;
      expect(buy.getAttribute("href")).toBe(`/pricing?app=${app.slug}#apps`);
    },
  );

  it("продаётся ТОЛЬКО месяц — «от» называет цену месяца, а не длинного срока", async () => {
    const app = STANDALONE_APPS.find((a) => a.slug === "qskyway")!;
    гостьСоСписком([`app_${app.slug}_lite`]);
    const { container } = render(<ModulePricingChip moduleId={app.moduleId} />);
    const месяц = termPricePerMonth(app.baseMonthly, "lite");
    const длинный = fromPricePerMonth(app.baseMonthly);
    // Ждать обязательно: список приходит запросом, и без ожидания проверка
    // видит только начальное значение — то есть проходит по случайности.
    await waitFor(() => expect(container.textContent ?? "").toContain(`$${месяц}`));
    expect(длинный).toBeLessThan(месяц);
    // Главное утверждение: цены, которую заплатить НЕЛЬЗЯ, на странице нет.
    // Замер 28.09 на живом проде: /qskyway обещал «от $8» при настоящих $16.
    expect(container.textContent ?? "").not.toContain(`$${длинный}/мес`);
  });

  it("продаются ВСЕ сроки — «от» снова называет самый длинный (контроль в обратную сторону)", async () => {
    const app = STANDALONE_APPS.find((a) => a.slug === "qskyway")!;
    гостьСоСписком(TERM_TIERS.map((t) => `app_${app.slug}_${t}`));
    const { container } = render(<ModulePricingChip moduleId={app.moduleId} />);
    // Без этого случая проверка выше проходила бы и на коде «всегда месяц»,
    // то есть не отличала бы починку от новой неправды в другую сторону.
    await waitFor(() =>
      expect(container.textContent ?? "").toContain(`$${fromPricePerMonth(app.baseMonthly)}`),
    );
  });

  it("модуль вне пяти: входит в подписку, отдельной цены нет", () => {
    guest();
    const { container } = render(<ModulePricingChip moduleId="qlearn" />);
    const text = container.textContent ?? "";
    expect(text).toContain("Входит в подписку AEVION");
    expect(text).toContain(`$${fromPricePerMonth(PLANET_BASE_MONTHLY)}`);
    expect(text).not.toContain("отдельно");
    expect(screen.getByText("Купить").closest("a")!.getAttribute("href")).toBe("/pricing#tiers");
  });

  it("короткий id витрины тоже узнаётся: bureau — это IP Bureau", () => {
    guest();
    const { container } = render(<ModulePricingChip moduleId="bureau" />);
    expect(container.textContent).toContain("IP Bureau");
  });

  it("снятые цены и имена тарифов на плашке не появляются", () => {
    guest();
    for (const id of ["cyberchess", "qlearn", "devhub"]) {
      const { container } = render(<ModulePricingChip moduleId={id} />);
      const text = container.textContent ?? "";
      expect(text, id).not.toMatch(/\$(19|29|39|49|59|149)(?!\d)|Universe|All-Access/);
      cleanup();
    }
  });

  it("имя приложения не уходит в машинный перевод", () => {
    guest();
    render(<ModulePricingChip moduleId="cyberchess" />);
    const el = screen.getByText(/CyberChess/);
    expect(el.getAttribute("translate")).toBe("no");
  });

  /*
   * 🔴 Слово на кнопке обязано совпадать с тем, что за ней.
   * Замер на проде 07.10.2026: /qright показывал «Buy», ссылка вела на
   * /pricing?app=qright#apps, а там по этому приложению только «Contact us»
   * (среди шести кнопок «Buy» на странице цен QRight нет), и касса отвечает
   * 400 invalid_app. Человек жал «Купить» и попадал в «напишите нам».
   */
  it("нечего купить (список продаваемых пуст) — кнопка зовёт обсудить, а не купить", async () => {
    const app = STANDALONE_APPS.find((a) => a.slug === "qright") ?? STANDALONE_APPS[0];
    гостьСоСписком([]);
    render(<ModulePricingChip moduleId={app.moduleId} />);

    await waitFor(() => {
      expect(
        screen.queryByText("Обсудить доступ"),
        "купить нечего, а кнопка всё ещё обещает покупку",
      ).not.toBeNull();
    });
    expect(
      screen.queryByText("Купить"),
      "«Купить» ведёт на контактную форму — это обещание, которого за кнопкой нет",
    ).toBeNull();
  });

  it("КОНТРОЛЬ: продаваемый срок есть — кнопка снова «Купить»", async () => {
    const app = STANDALONE_APPS.find((a) => a.slug === "qright") ?? STANDALONE_APPS[0];
    гостьСоСписком([`app_${app.slug}_lite`]);
    render(<ModulePricingChip moduleId={app.moduleId} />);

    await waitFor(() => {
      expect(
        screen.queryByText("Купить"),
        "продаётся, а кнопка не предлагает купить — проверка перекрыла лишнее",
      ).not.toBeNull();
    });
    expect(screen.queryByText("Обсудить доступ")).toBeNull();
  });
});
