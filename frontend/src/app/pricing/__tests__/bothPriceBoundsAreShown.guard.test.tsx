import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";
import { STANDALONE_APPS, termPricePerMonth } from "@/lib/termPricing";

/**
 * КАРТОЧКА ПРИЛОЖЕНИЯ ПОКАЗЫВАЕТ ОБЕ ГРАНИЦЫ ЦЕНЫ.
 *
 * Повод 29.09.2026 (нашло окно шахмат). Кнопка на /cyberchess обещает
 * «от $12/мес» — это месяц на самом длинном сроке. Человек приходит на
 * /pricing?app=cyberchess, видит $24/мес на сроке Lite и читает это как ошибку:
 * на том же экране таблица «Все модули» даёт половинные числа, а блок
 * приложений — полные. Обе цены честные; расходится не цена, а то, о каком
 * сроке речь. Поэтому рядом с ценой выбранного срока стоит вторая граница —
 * месяц на сроке Max.
 *
 * Сторож держит именно ОБЕ границы: одна цена на карточке — это и есть тот
 * случай, который пришлось чинить.
 */

/**
 * Что касса объявляет продаваемым. По умолчанию — все сроки CyberChess: у него
 * они и правда все пять есть на проде. Тест ниже меняет список, чтобы проверить
 * обратный случай: срок, которого купить нельзя, обещать нельзя.
 */
let ПРОДАЁТСЯ: string[] = [
  "app_cyberchess_lite",
  "app_cyberchess_medium",
  "app_cyberchess_pro",
  "app_cyberchess_full",
  "app_cyberchess_max",
];

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
      tiers: [], modules: [], bundles: [], notes: [], items: [], runs: [],
    }) } as unknown as Response;
  });
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("цена приложения на витрине", () => {
  it("рядом с ценой месяца стоит цена месяца на длинном сроке", async () => {
    ответыСервера();
    const m = await import("@/app/pricing/page");
    const Страница = m.default as () => import("react").JSX.Element;
    await act(async () => {
      render(
        <I18nProvider>
          <Страница />
        </I18nProvider>,
      );
    });
    const карточка = document.querySelector('[data-app="cyberchess"]');
    expect(карточка, "карточки CyberChess нет на странице").not.toBeNull();
    const текст = (карточка?.textContent || "").trim();

    const шахматы = STANDALONE_APPS.find((a) => a.slug === "cyberchess")!;
    const наМесяц = termPricePerMonth(шахматы.baseMonthly, "lite");
    const наГод = termPricePerMonth(шахматы.baseMonthly, "max");

    // Контроль осмысленности: границы должны различаться, иначе проверка ниже
    // ничего не значит.
    expect(наГод, "границы совпали — лестница сроков сломана").toBeLessThan(наМесяц);

    expect(
      текст.includes(String(наМесяц)),
      `в карточке нет цены выбранного срока ${наМесяц}`,
    ).toBe(true);
    expect(
      текст.includes(String(наГод)),
      `в карточке нет второй границы ${наГод} — обещание «от $${наГод}/мес» на странице продукта снова читается как ошибка`,
    ).toBe(true);
  }, 120000);
});

describe("вторая граница обещается только тогда, когда срок ПРОДАЁТСЯ", () => {
  /*
   * 30.09.2026. Первая версия правки показывала «Max · 12 месяцев: $X/мес» у
   * всех приложений. А у QRight, QSign, биржи и QSkyway срок Max купить нельзя:
   * касса на medium…max отвечает 503, продаётся только lite. Витрина обещала
   * вдвое меньшую цену за срок, которого нет — ложное обещание на странице
   * оплаты. Нашло окно user-2b на живом проде.
   */
  it("срок Max не продаётся — второй границы нет", async () => {
    ПРОДАЁТСЯ = ["app_cyberchess_lite"]; // только месяц, как у QRight и QSkyway
    ответыСервера();
    const m = await import("@/app/pricing/page");
    const Страница = m.default as () => import("react").JSX.Element;
    await act(async () => {
      render(
        <I18nProvider>
          <Страница />
        </I18nProvider>,
      );
    });
    const карточка = document.querySelector('[data-app="cyberchess"]');
    const текст = (карточка?.textContent || "").trim();
    const шахматы = STANDALONE_APPS.find((a) => a.slug === "cyberchess")!;
    const наГод = termPricePerMonth(шахматы.baseMonthly, "max");
    expect(
      текст.includes(String(наГод)),
      `обещана цена ${наГод} за срок, который касса не продаёт`,
    ).toBe(false);
    // Контроль: цена ПРОДАВАЕМОГО срока при этом на месте, карточка не опустела.
    expect(текст.includes(String(termPricePerMonth(шахматы.baseMonthly, "lite")))).toBe(true);
  }, 120000);
});

describe("список продаваемого не пришёл — молчим, а не обещаем", () => {
  /*
   * Правило обратное кнопке намеренно: у кнопки незнание НЕ запрещает покупку
   * (иначе временный сбой опроса гасит кассу целиком), а у цены незнание не
   * имеет права обещать скидку — человек увидит число, которого может не быть,
   * и проверить ему нечем.
   */
  it("касса не ответила — второй границы нет", async () => {
    vi.stubGlobal("fetch", async (u: string) => {
      const адрес = String(u);
      if (адрес.includes("checkout/healthz")) {
        // Сбой опроса: список продаваемого неизвестен.
        return { ok: false, status: 503, json: async () => ({}) } as unknown as Response;
      }
      if (адрес.includes("/pricing/trust")) {
        return { ok: true, status: 200, json: async () => ({ numbers: [], badges: [] }) } as unknown as Response;
      }
      return { ok: true, status: 200, json: async () => ({
        currencies: { USD: { symbol: "$", rate: 1 }, KZT: { symbol: "₸", rate: 470 }, EUR: { symbol: "€", rate: 0.92 } },
        tiers: [], modules: [], bundles: [], notes: [], items: [], runs: [],
      }) } as unknown as Response;
    });
    const m = await import("@/app/pricing/page");
    const Страница = m.default as () => import("react").JSX.Element;
    await act(async () => {
      render(
        <I18nProvider>
          <Страница />
        </I18nProvider>,
      );
    });
    const карточка = document.querySelector('[data-app="cyberchess"]');
    const текст = (карточка?.textContent || "").trim();
    const шахматы = STANDALONE_APPS.find((a) => a.slug === "cyberchess")!;
    // Контроль: карточка отрисовалась и цена месяца на месте — иначе проверка
    // ниже прошла бы на пустом экране.
    expect(текст.includes(String(termPricePerMonth(шахматы.baseMonthly, "lite")))).toBe(true);
    expect(
      текст.includes(String(termPricePerMonth(шахматы.baseMonthly, "max"))),
      "список не пришёл, а цена длинного срока всё равно обещана",
    ).toBe(false);
  }, 120000);
});
