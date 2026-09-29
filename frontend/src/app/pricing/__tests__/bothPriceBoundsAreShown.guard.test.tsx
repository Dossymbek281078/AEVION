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

function ответыСервера() {
  vi.stubGlobal("fetch", async (u: string) => {
    const адрес = String(u);
    if (адрес.includes("checkout/healthz")) {
      return { ok: true, status: 200, json: async () => ({ ok: true, providers: { paybox: { configured: false }, lemonsqueezy: { configured: true } } }) } as unknown as Response;
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
